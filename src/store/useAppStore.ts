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
  RecurringTemplate,
  Season,
  Settings,
} from '../shared/types/domain.ts';
import { createId, createUuid } from '../shared/lib/id.ts';
import { categoryByCode } from '../shared/lib/categories.ts';
import { computeBilan } from '../shared/lib/engine.ts';
import { createEmptyData } from '../shared/lib/seed.ts';
import { loadData, saveData } from '../shared/lib/storage.ts';
import { IS_SUPABASE } from '../backend/config.ts';
import { emitRemote, type RemoteOp } from '../backend/syncBus.ts';
import { getCurrentClubId } from '../backend/clubContext.ts';

/** Acteur courant (mode local). En mode Supabase, l'email de session le remplace. */
let currentActor = 'local';
export function setCurrentActor(actor: string): void {
  currentActor = actor;
}

/** Statut de synchronisation (mode Supabase). Non persisté. */
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ready' | 'error';
  error?: string;
}

/** Émet une intention de synchronisation (no-op en mode local). */
function remote(op: RemoteOp): void {
  if (IS_SUPABASE) emitRemote(op);
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
  /** Statut de synchronisation Supabase (mode supabase uniquement). */
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
  /** Remplace l'état depuis un pull serveur (sans trace d'audit locale). */
  hydrate: (data: AppData) => void;

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
  updateEvent: (id: string, patch: { name?: string; kind?: EventKind }) => void;
  deleteEvent: (id: string) => void;

  // Récurrences & budget
  addRecurring: (t: Omit<RecurringTemplate, 'id'>) => string;
  deleteRecurring: (id: string) => void;
  generateFromRecurring: (id: string, date: string) => string | null;
  setBudget: (seasonId: string, code: string, amount: number) => void;

  // Écritures
  addEntry: (input: EntryInput) => string | null;
  importEntries: (drafts: EntryInput[]) => number;
  updateEntry: (id: string, patch: Partial<EntryInput>) => void;
  setReconciled: (id: string, reconciled: boolean) => void;
  softDeleteEntry: (id: string, reason?: string) => void;
  restoreEntry: (id: string) => void;
  addAttachment: (entryId: string, attachment: Attachment) => void;
  removeAttachment: (entryId: string, attId: string) => void;

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
    syncStatus: { state: 'idle' },

    setSyncStatus: status => set({ syncStatus: status }),

    hydrate: data => set({ data: persist(data) }),

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
        id: createUuid(),
        clubId: getCurrentClubId(),
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
      remote({ kind: 'season.upsert', season });
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
        remote({ kind: 'season.upsert', season: closed });
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
        remote({ kind: 'season.upsert', season: reopened });
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
        const updated: Season = { ...season, openingBalance: opening };
        remote({ kind: 'season.upsert', season: updated });
        return {
          data: persist(
            audit(
              {
                ...s.data,
                seasons: s.data.seasons.map(x => (x.id === id ? updated : x)),
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
        const updated: Season = { ...to, openingBalance: opening };
        remote({ kind: 'season.upsert', season: updated });
        return {
          data: persist(
            audit(
              {
                ...s.data,
                seasons: s.data.seasons.map(x => (x.id === toId ? updated : x)),
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
        id: createUuid(),
        seasonId: get().data.activeSeasonId,
        name,
        kind,
      };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, events: [...s.data.events, ev] },
            'event.create',
            'metier',
            'event',
            `Création de l'événement « ${name} ».`,
            { targetId: ev.id }
          )
        ),
      }));
      remote({ kind: 'event.upsert', event: ev });
      return ev.id;
    },

    updateEvent: (id, patch) =>
      set(s => {
        const ev = s.data.events.find(e => e.id === id);
        if (!ev) return s;
        const updated: EventLedger = { ...ev, ...patch };
        remote({ kind: 'event.upsert', event: updated });
        return {
          data: persist({
            ...s.data,
            events: s.data.events.map(e => (e.id === id ? updated : e)),
          }),
        };
      }),

    deleteEvent: id =>
      set(s => {
        const ev = s.data.events.find(e => e.id === id);
        if (!ev) return s;
        // Détache les écritures rattachées (sans les supprimer) puis retire
        // l'événement. Côté serveur, la FK `on delete set null` détache aussi.
        const entries = s.data.entries.map(e =>
          e.eventId === id ? { ...e, eventId: undefined } : e
        );
        remote({ kind: 'event.delete', id });
        return {
          data: persist(
            audit(
              {
                ...s.data,
                entries,
                events: s.data.events.filter(e => e.id !== id),
              },
              'event.delete',
              'metier',
              'event',
              `Suppression de l'événement « ${ev.name} » (écritures détachées).`,
              { targetId: id }
            )
          ),
        };
      }),

    addRecurring: t => {
      const tpl: RecurringTemplate = { ...t, id: createId('rec') };
      set(s => ({
        data: persist({ ...s.data, recurrings: [...s.data.recurrings, tpl] }),
      }));
      return tpl.id;
    },

    deleteRecurring: id =>
      set(s => ({
        data: persist({
          ...s.data,
          recurrings: s.data.recurrings.filter(r => r.id !== id),
        }),
      })),

    generateFromRecurring: (id, date) => {
      const { data } = get();
      const tpl = data.recurrings.find(r => r.id === id);
      if (!tpl) return null;
      const cat = categoryByCode(tpl.categoryCode);
      const sens = cat?.sens === 'depense' ? 'debit' : 'credit';
      return get().addEntry({
        seasonId: data.activeSeasonId,
        categoryCode: tpl.categoryCode,
        date,
        label: tpl.label,
        sens,
        amount: tpl.amount,
        method: tpl.method,
      });
    },

    setBudget: (seasonId, code, amount) =>
      set(s => ({
        data: persist({
          ...s.data,
          seasons: s.data.seasons.map(x =>
            x.id === seasonId
              ? {
                  ...x,
                  budget: { ...(x.budget ?? {}), [code]: amount },
                }
              : x
          ),
        }),
      })),

    addEntry: input => {
      const data = get().data;
      if (isLocked(data, input.seasonId)) {
        console.warn('[miss-uwh] saison verrouillée : création refusée');
        return null;
      }
      const now = Date.now();
      const entry: JournalEntry = {
        ...input,
        id: createUuid(),
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
      remote({ kind: 'entry.upsert', entry });
      return entry.id;
    },

    importEntries: drafts => {
      const data = get().data;
      const now = Date.now();
      const accepted = drafts.filter(d => !isLocked(data, d.seasonId));
      const created: JournalEntry[] = accepted.map((d, i) => ({
        ...d,
        id: createUuid(),
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
      remote({ kind: 'entry.bulkUpsert', entries: created });
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
        remote({ kind: 'entry.upsert', entry: after });
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

    setReconciled: (id, reconciled) =>
      set(s => {
        const before = s.data.entries.find(e => e.id === id);
        if (!before || isLocked(s.data, before.seasonId)) return s;
        const after: JournalEntry = {
          ...before,
          reconciled,
          reconciledAt: reconciled ? Date.now() : undefined,
          updatedAt: Date.now(),
          updatedBy: currentActor,
          version: before.version + 1,
        };
        remote({ kind: 'entry.upsert', entry: after });
        return {
          data: persist(
            audit(
              {
                ...s.data,
                entries: s.data.entries.map(e => (e.id === id ? after : e)),
              },
              'entry.reconcile',
              'metier',
              'entry',
              `Écriture « ${before.label} » ${reconciled ? 'pointée' : 'dépointée'} (rapprochement).`,
              { targetId: id }
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
        remote({ kind: 'entry.upsert', entry: after });
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
        remote({ kind: 'entry.upsert', entry: after });
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

    // Les justificatifs vivent dans une table à part (Supabase Storage en mode
    // serveur) ; ces actions ne mettent à jour que l'état local + l'audit (pas
    // d'emit `entry.upsert` : la colonne attachments n'existe pas côté entries).
    addAttachment: (entryId, attachment) =>
      set(s => {
        const before = s.data.entries.find(e => e.id === entryId);
        if (!before || isLocked(s.data, before.seasonId)) return s;
        const after = {
          ...before,
          attachments: [...before.attachments, attachment],
          updatedAt: Date.now(),
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
              `Pièce jointe « ${attachment.name} » ajoutée à « ${before.label} ».`,
              { targetId: entryId }
            )
          ),
        };
      }),

    removeAttachment: (entryId, attId) =>
      set(s => {
        const before = s.data.entries.find(e => e.id === entryId);
        if (!before || isLocked(s.data, before.seasonId)) return s;
        const att = before.attachments.find(a => a.id === attId);
        const after = {
          ...before,
          attachments: before.attachments.filter(a => a.id !== attId),
          updatedAt: Date.now(),
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
              'entry.detach',
              'metier',
              'entry',
              `Pièce jointe${att ? ` « ${att.name} »` : ''} retirée de « ${before.label} ».`,
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
