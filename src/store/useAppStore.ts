/**
 * Store applicatif (Zustand) — source de vérité unique de l'état persisté.
 *
 * Invariants appliqués ici (défense en profondeur, complétée côté serveur par
 * les politiques RLS Supabase en mode multi-utilisateurs) :
 *  - toute mutation passe par `commit()` : un seul point de persistance ;
 *  - toute mutation significative écrit une entrée d'audit (règles 13–14) ;
 *  - une écriture rattachée à une saison CLÔTURÉE est verrouillée : pas de
 *    création / modification / suppression tant que la saison n'est pas rouverte
 *    (règle « clôture avec verrouillage ») ;
 *  - les suppressions sont LOGIQUES (deletedAt), jamais physiques (règle 14).
 */
import { create } from 'zustand';
import type {
  AppData,
  Attachment,
  AuditCategory,
  AuditEvent,
  Club,
  EventKind,
  EventLedger,
  JournalEntry,
  Season,
  Settings,
} from '../shared/types/domain.ts';
import { createId } from '../shared/lib/id.ts';
import { computeBilan } from '../shared/lib/engine.ts';
import { createEmptyData } from '../shared/lib/seed.ts';
import { loadData, saveData } from '../shared/lib/storage.ts';

/** Acteur courant (mode local). En mode Supabase, l'email de session le remplace. */
let currentActor = 'local';
export function setCurrentActor(actor: string): void {
  currentActor = actor;
}

export type EntryInput = Omit<
  JournalEntry,
  | 'id'
  | 'attachments'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'version'
  | 'deletedAt'
  | 'deletedBy'
>;

interface AppState {
  data: AppData;

  // Méta
  completeOnboarding: () => void;
  setupClub: (club: Club, seasonLabel: string, opening: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateClub: (patch: Partial<Club>) => void;

  // Saisons
  setActiveSeason: (id: string) => void;
  addSeason: (label: string, opening: number) => string;
  closeSeason: (id: string) => void;
  reopenSeason: (id: string, reason: string) => void;
  setSeasonOpening: (id: string, opening: number) => void;
  carryOverReliquat: (fromId: string, toId: string) => void;

  // Événements
  addEvent: (name: string, kind: EventKind) => string;

  // Écritures
  addEntry: (input: EntryInput) => string | null;
  importEntries: (drafts: EntryInput[]) => number;
  updateEntry: (id: string, patch: Partial<EntryInput>) => void;
  softDeleteEntry: (id: string, reason?: string) => void;
  restoreEntry: (id: string) => void;
  addAttachment: (entryId: string, att: Omit<Attachment, 'id'>) => void;

  // Sécurité / audit
  logSecurity: (action: string, summary: string) => void;

  // Données globales
  replaceData: (data: AppData) => void;
  resetAll: (clubName?: string, seasonLabel?: string, opening?: number) => void;
}

function persist(data: AppData): AppData {
  saveData(data);
  return data;
}

function audit(
  data: AppData,
  action: string,
  category: AuditCategory,
  targetType: string,
  summary: string,
  extra?: { targetId?: string; before?: unknown; after?: unknown }
): AppData {
  const event: AuditEvent = {
    id: createId('aud'),
    ts: Date.now(),
    actor: currentActor,
    action,
    category,
    targetType,
    targetId: extra?.targetId,
    summary,
    before: extra?.before,
    after: extra?.after,
  };
  // borne souple : on conserve les 1000 derniers événements côté client.
  const auditLog = [...data.audit, event].slice(-1000);
  return { ...data, audit: auditLog };
}

export const useAppStore = create<AppState>((set, get) => {
  function seasonOf(data: AppData, seasonId: string): Season | undefined {
    return data.seasons.find(s => s.id === seasonId);
  }
  function isLocked(data: AppData, seasonId: string): boolean {
    return seasonOf(data, seasonId)?.status === 'cloturee';
  }

  return {
    data: loadData(),

    completeOnboarding: () =>
      set(s => ({ data: persist({ ...s.data, onboarded: true }) })),

    setupClub: (club, seasonLabel, opening) =>
      set(s => {
        const season = s.data.seasons.find(x => x.id === s.data.activeSeasonId);
        const seasons = season
          ? s.data.seasons.map(x =>
              x.id === season.id
                ? { ...x, label: seasonLabel, openingBalance: opening }
                : x
            )
          : s.data.seasons;
        return {
          data: persist({ ...s.data, club, seasons, onboarded: true }),
        };
      }),

    setTheme: theme => {
      document.documentElement.dataset.theme = theme;
      set(s => ({
        data: persist({
          ...s.data,
          settings: { ...s.data.settings, theme },
        }),
      }));
    },

    updateSettings: patch =>
      set(s => ({
        data: persist({
          ...s.data,
          settings: { ...s.data.settings, ...patch },
        }),
      })),

    updateClub: patch =>
      set(s => ({
        data: persist(
          audit(
            { ...s.data, club: { ...s.data.club, ...patch } },
            'club.update',
            'metier',
            'club',
            'Mise à jour des informations du club.'
          )
        ),
      })),

    setActiveSeason: id =>
      set(s => ({ data: persist({ ...s.data, activeSeasonId: id }) })),

    addSeason: (label, opening) => {
      const year = Number(label.slice(0, 4)) || new Date().getFullYear();
      const season: Season = {
        id: createId('sea'),
        label,
        startDate: `${year}-09-01`,
        endDate: `${year + 1}-08-31`,
        status: 'ouverte',
        openingBalance: opening,
      };
      set(s => ({
        data: persist(
          audit(
            {
              ...s.data,
              seasons: [...s.data.seasons, season],
              activeSeasonId: season.id,
            },
            'season.create',
            'metier',
            'season',
            `Création de la saison ${label}.`,
            { targetId: season.id }
          )
        ),
      }));
      return season.id;
    },

    closeSeason: id =>
      set(s => {
        const season = seasonOf(s.data, id);
        if (!season || season.status === 'cloturee') return s;
        const bilan = computeBilan(season, s.data.entries);
        const closed: Season = {
          ...season,
          status: 'cloturee',
          closingBalance: bilan.tresorerie,
          lockedAt: Date.now(),
          lockedBy: currentActor,
        };
        return {
          data: persist(
            audit(
              {
                ...s.data,
                seasons: s.data.seasons.map(x => (x.id === id ? closed : x)),
              },
              'season.close',
              'securite',
              'season',
              `Clôture et verrouillage de la saison ${season.label} (solde ${bilan.tresorerie.toFixed(2)} €).`,
              { targetId: id, after: { closingBalance: bilan.tresorerie } }
            )
          ),
        };
      }),

    reopenSeason: (id, reason) =>
      set(s => {
        const season = seasonOf(s.data, id);
        if (!season || season.status !== 'cloturee') return s;
        const reopened: Season = {
          ...season,
          status: 'ouverte',
          reopenedAt: Date.now(),
          reopenReason: reason,
        };
        return {
          data: persist(
            audit(
              {
                ...s.data,
                seasons: s.data.seasons.map(x => (x.id === id ? reopened : x)),
              },
              'season.reopen',
              'securite',
              'season',
              `Réouverture exceptionnelle de la saison ${season.label} — motif : ${reason}.`,
              { targetId: id }
            )
          ),
        };
      }),

    setSeasonOpening: (id, opening) =>
      set(s => {
        const season = seasonOf(s.data, id);
        if (!season || season.status === 'cloturee') return s;
        return {
          data: persist(
            audit(
              {
                ...s.data,
                seasons: s.data.seasons.map(x =>
                  x.id === id ? { ...x, openingBalance: opening } : x
                ),
              },
              'season.opening',
              'metier',
              'season',
              `Reliquat d'ouverture de ${season.label} fixé à ${opening.toFixed(2)} €.`,
              { targetId: id }
            )
          ),
        };
      }),

    carryOverReliquat: (fromId, toId) =>
      set(s => {
        const from = seasonOf(s.data, fromId);
        const to = seasonOf(s.data, toId);
        if (!from || !to || to.status === 'cloturee') return s;
        const opening = from.closingBalance ?? from.openingBalance;
        return {
          data: persist(
            audit(
              {
                ...s.data,
                seasons: s.data.seasons.map(x =>
                  x.id === toId ? { ...x, openingBalance: opening } : x
                ),
              },
              'season.carryover',
              'metier',
              'season',
              `Report du solde de clôture de ${from.label} comme reliquat d'ouverture de ${to.label} (${opening.toFixed(2)} €).`,
              { targetId: toId }
            )
          ),
        };
      }),

    addEvent: (name, kind) => {
      const ev: EventLedger = {
        id: createId('ev'),
        seasonId: get().data.activeSeasonId,
        name,
        kind,
      };
      set(s => ({
        data: persist({ ...s.data, events: [...s.data.events, ev] }),
      }));
      return ev.id;
    },

    addEntry: input => {
      const data = get().data;
      if (isLocked(data, input.seasonId)) {
        console.warn('[miss-uwh] saison verrouillée : création refusée');
        return null;
      }
      const now = Date.now();
      const entry: JournalEntry = {
        ...input,
        id: createId('ec'),
        attachments: [],
        createdAt: now,
        createdBy: currentActor,
        updatedAt: now,
        updatedBy: currentActor,
        version: 1,
      };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, entries: [...s.data.entries, entry] },
            'entry.create',
            'metier',
            'entry',
            `Écriture « ${entry.label} » (${entry.sens === 'credit' ? '+' : '−'}${entry.amount.toFixed(2)} €, ${entry.categoryCode}).`,
            { targetId: entry.id, after: entry }
          )
        ),
      }));
      return entry.id;
    },

    importEntries: drafts => {
      const data = get().data;
      const now = Date.now();
      const accepted = drafts.filter(d => !isLocked(data, d.seasonId));
      const created: JournalEntry[] = accepted.map((d, i) => ({
        ...d,
        id: createId('ec'),
        attachments: [],
        createdAt: now + i,
        createdBy: currentActor,
        updatedAt: now + i,
        updatedBy: currentActor,
        version: 1,
      }));
      set(s => ({
        data: persist(
          audit(
            { ...s.data, entries: [...s.data.entries, ...created] },
            'data.import.entries',
            'securite',
            'app',
            `Import de ${created.length} écriture(s) depuis un fichier externe.`
          )
        ),
      }));
      return created.length;
    },

    updateEntry: (id, patch) =>
      set(s => {
        const before = s.data.entries.find(e => e.id === id);
        if (!before || isLocked(s.data, before.seasonId)) return s;
        const after: JournalEntry = {
          ...before,
          ...patch,
          updatedAt: Date.now(),
          updatedBy: currentActor,
          version: before.version + 1,
        };
        return {
          data: persist(
            audit(
              {
                ...s.data,
                entries: s.data.entries.map(e => (e.id === id ? after : e)),
              },
              'entry.update',
              'metier',
              'entry',
              `Modification de l'écriture « ${after.label} » (v${after.version}).`,
              { targetId: id, before, after }
            )
          ),
        };
      }),

    softDeleteEntry: (id, reason) =>
      set(s => {
        const before = s.data.entries.find(e => e.id === id);
        if (!before || before.deletedAt || isLocked(s.data, before.seasonId))
          return s;
        const after: JournalEntry = {
          ...before,
          deletedAt: Date.now(),
          deletedBy: currentActor,
          observation: reason
            ? `${before.observation ? before.observation + ' — ' : ''}Suppression : ${reason}`
            : before.observation,
          version: before.version + 1,
        };
        return {
          data: persist(
            audit(
              {
                ...s.data,
                entries: s.data.entries.map(e => (e.id === id ? after : e)),
              },
              'entry.delete',
              'securite',
              'entry',
              `Suppression logique de « ${before.label} »${reason ? ` — motif : ${reason}` : ''}.`,
              { targetId: id, before }
            )
          ),
        };
      }),

    restoreEntry: id =>
      set(s => {
        const before = s.data.entries.find(e => e.id === id);
        if (!before || !before.deletedAt || isLocked(s.data, before.seasonId))
          return s;
        const { deletedAt: _d, deletedBy: _b, ...rest } = before;
        const after: JournalEntry = {
          ...rest,
          version: before.version + 1,
          updatedAt: Date.now(),
          updatedBy: currentActor,
        };
        return {
          data: persist(
            audit(
              {
                ...s.data,
                entries: s.data.entries.map(e => (e.id === id ? after : e)),
              },
              'entry.restore',
              'securite',
              'entry',
              `Restauration de l'écriture « ${before.label} ».`,
              { targetId: id }
            )
          ),
        };
      }),

    addAttachment: (entryId, att) =>
      set(s => {
        const before = s.data.entries.find(e => e.id === entryId);
        if (!before || isLocked(s.data, before.seasonId)) return s;
        const attachment: Attachment = { ...att, id: createId('att') };
        const after = {
          ...before,
          attachments: [...before.attachments, attachment],
          updatedAt: Date.now(),
          version: before.version + 1,
        };
        return {
          data: persist(
            audit(
              {
                ...s.data,
                entries: s.data.entries.map(e =>
                  e.id === entryId ? after : e
                ),
              },
              'entry.attach',
              'metier',
              'entry',
              `Pièce jointe « ${att.name} » ajoutée à « ${before.label} ».`,
              { targetId: entryId }
            )
          ),
        };
      }),

    logSecurity: (action, summary) =>
      set(s => ({
        data: persist(audit(s.data, action, 'securite', 'session', summary)),
      })),

    replaceData: data =>
      // L'import remplace tout l'état ; on consigne l'opération dans le nouvel
      // état importé (trace conservée même après remplacement).
      set({
        data: persist(
          audit(
            data,
            'data.import',
            'securite',
            'app',
            `Import de données (${data.entries.length} écritures, ${data.seasons.length} saisons).`
          )
        ),
      }),

    resetAll: (clubName, seasonLabel, opening) =>
      set(() => ({
        data: persist(createEmptyData(clubName, seasonLabel, opening)),
      })),
  };
});

/** Sélecteur : saison active (toujours définie). */
export function selectActiveSeason(s: AppState): Season {
  return (
    s.data.seasons.find(x => x.id === s.data.activeSeasonId) ??
    s.data.seasons[0]!
  );
}

/** Sélecteur : écritures actives de la saison active. */
export function selectActiveEntries(s: AppState): JournalEntry[] {
  const sid = s.data.activeSeasonId;
  return s.data.entries.filter(e => e.seasonId === sid && !e.deletedAt);
}
