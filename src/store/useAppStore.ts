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
  Adherent,
  Announcement,
  AppData,
  Attachment,
  AuditCategory,
  AuditEvent,
  Category,
  Club,
  ClubEvent,
  EventKind,
  EventLedger,
  Exercise,
  Guardian,
  JournalEntry,
  RecurringTemplate,
  Season,
  Sens,
  Settings,
  TrainingSession,
  Tournament,
} from '../shared/types/domain.ts';
import { createId, createUuid } from '../shared/lib/id.ts';
import {
  categoryByCode,
  setCustomCategories,
} from '../shared/lib/categories.ts';
import { computeBilan } from '../shared/lib/engine.ts';
import { createEmptyData } from '../shared/lib/seed.ts';
import { loadData, saveData } from '../shared/lib/storage.ts';
import { IS_SUPABASE } from '../backend/config.ts';
import { emitRemote, type RemoteOp } from '../backend/syncBus.ts';
import { getCurrentClubId } from '../backend/clubContext.ts';
import { clearAll as clearSyncQueue } from '../backend/syncQueue.ts';

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

  // Catégories personnalisées
  addCustomCategory: (input: {
    label: string;
    sens: Sens;
    kind?: Category['kind'];
  }) => string;
  removeCustomCategory: (code: string) => void;

  // Adhérents (registre)
  addAdherent: (a: Omit<Adherent, 'id'>) => string;
  updateAdherent: (id: string, patch: Partial<Omit<Adherent, 'id'>>) => void;
  deleteAdherent: (id: string) => void;

  // Familles / tuteurs
  addGuardian: (g: Omit<Guardian, 'id'>) => string;
  updateGuardian: (id: string, patch: Partial<Omit<Guardian, 'id'>>) => void;
  deleteGuardian: (id: string) => void;

  // Vie du club : événements (agenda) & annonces
  addClubEvent: (e: Omit<ClubEvent, 'id'>) => string;
  updateClubEvent: (id: string, patch: Partial<Omit<ClubEvent, 'id'>>) => void;
  deleteClubEvent: (id: string) => void;
  addAnnouncement: (a: Omit<Announcement, 'id'>) => string;
  updateAnnouncement: (
    id: string,
    patch: Partial<Omit<Announcement, 'id'>>
  ) => void;
  deleteAnnouncement: (id: string) => void;

  // Tournois
  addTournament: (t: Omit<Tournament, 'id'>) => string;
  updateTournament: (
    id: string,
    patch: Partial<Omit<Tournament, 'id'>>
  ) => void;
  deleteTournament: (id: string) => void;

  // Entraînements : séances & exercices
  addTrainingSession: (s: Omit<TrainingSession, 'id'>) => string;
  updateTrainingSession: (
    id: string,
    patch: Partial<Omit<TrainingSession, 'id'>>
  ) => void;
  deleteTrainingSession: (id: string) => void;
  addExercise: (e: Omit<Exercise, 'id'>) => string;
  updateExercise: (id: string, patch: Partial<Omit<Exercise, 'id'>>) => void;
  deleteExercise: (id: string) => void;

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
  /**
   * Purge des données locales (mode Supabase, à la déconnexion) : vide le
   * miroir localStorage + la file de synchro pour qu'aucune donnée d'un membre
   * ne subsiste sur un appareil partagé (RGPD). Le serveur reste la source.
   */
  wipeLocal: () => void;
}

function persist(data: AppData): AppData {
  saveData(data);
  // Garde le registre de catégories (taxonomie + perso) synchronisé partout.
  setCustomCategories(data.customCategories);
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
  // Synchronise le registre de catégories dès l'init (avant tout commit).
  setCustomCategories(loadData().customCategories);

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
        // Serveur : RPC qui recalcule le solde et vérifie le rôle (le local
        // calcule aussi pour l'affichage immédiat ; ils coïncident).
        remote({ kind: 'season.close', id });
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
        remote({ kind: 'season.reopen', id, reason });
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
      // UUID : id local = clé primaire Postgres (upsert idempotent).
      const tpl: RecurringTemplate = { ...t, id: createUuid() };
      set(s => ({
        data: persist({ ...s.data, recurrings: [...s.data.recurrings, tpl] }),
      }));
      remote({ kind: 'recurring.upsert', recurring: tpl });
      return tpl.id;
    },

    deleteRecurring: id =>
      set(s => {
        remote({ kind: 'recurring.delete', id });
        return {
          data: persist({
            ...s.data,
            recurrings: s.data.recurrings.filter(r => r.id !== id),
          }),
        };
      }),

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

    addCustomCategory: input => {
      const existing = new Set([
        ...get().data.customCategories.map(c => c.code),
        // codes réservés type C1, C2…
      ]);
      let n = get().data.customCategories.length + 1;
      let code = `C${n}`;
      while (existing.has(code)) code = `C${++n}`;
      const cat: Category = {
        code,
        label: input.label,
        sens: input.sens,
        kind: input.kind ?? 'exploitation',
      };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, customCategories: [...s.data.customCategories, cat] },
            'category.create',
            'metier',
            'category',
            `Catégorie personnalisée « ${input.label} » (${code}).`,
            { targetId: code }
          )
        ),
      }));
      remote({ kind: 'category.upsert', category: cat });
      return code;
    },

    removeCustomCategory: code =>
      set(s => {
        remote({ kind: 'category.delete', code });
        return {
          data: persist({
            ...s.data,
            customCategories: s.data.customCategories.filter(
              c => c.code !== code
            ),
          }),
        };
      }),

    addAdherent: a => {
      // UUID : id local = clé primaire Postgres (upsert idempotent).
      const adherent: Adherent = { ...a, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, adherents: [...s.data.adherents, adherent] },
            'adherent.create',
            'metier',
            'adherent',
            `Adhérent « ${a.firstName} ${a.lastName} » ajouté.`,
            { targetId: adherent.id }
          )
        ),
      }));
      remote({ kind: 'adherent.upsert', adherent });
      return adherent.id;
    },

    updateAdherent: (id, patch) =>
      set(s => {
        const before = s.data.adherents.find(x => x.id === id);
        if (!before) return s;
        const after: Adherent = { ...before, ...patch };
        remote({ kind: 'adherent.upsert', adherent: after });
        return {
          data: persist({
            ...s.data,
            adherents: s.data.adherents.map(x => (x.id === id ? after : x)),
          }),
        };
      }),

    deleteAdherent: id =>
      set(s => {
        remote({ kind: 'adherent.delete', id });
        // Le serveur supprime les tuteurs en cascade (FK) ; on reflète localement.
        return {
          data: persist({
            ...s.data,
            adherents: s.data.adherents.filter(x => x.id !== id),
            guardians: s.data.guardians.filter(g => g.memberId !== id),
          }),
        };
      }),

    addGuardian: g => {
      const guardian: Guardian = { ...g, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, guardians: [...s.data.guardians, guardian] },
            'guardian.create',
            'metier',
            'guardian',
            `Tuteur/contact « ${g.name} » ajouté.`,
            { targetId: guardian.id }
          )
        ),
      }));
      remote({ kind: 'guardian.upsert', guardian });
      return guardian.id;
    },

    updateGuardian: (id, patch) =>
      set(s => {
        const before = s.data.guardians.find(x => x.id === id);
        if (!before) return s;
        const after: Guardian = { ...before, ...patch };
        remote({ kind: 'guardian.upsert', guardian: after });
        return {
          data: persist({
            ...s.data,
            guardians: s.data.guardians.map(x => (x.id === id ? after : x)),
          }),
        };
      }),

    deleteGuardian: id =>
      set(s => {
        remote({ kind: 'guardian.delete', id });
        return {
          data: persist({
            ...s.data,
            guardians: s.data.guardians.filter(x => x.id !== id),
          }),
        };
      }),

    addClubEvent: e => {
      const ev: ClubEvent = { ...e, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, clubEvents: [...s.data.clubEvents, ev] },
            'clubevent.create',
            'metier',
            'clubevent',
            `Événement « ${e.title} » ajouté à l'agenda.`,
            { targetId: ev.id }
          )
        ),
      }));
      remote({ kind: 'clubevent.upsert', clubEvent: ev });
      return ev.id;
    },

    updateClubEvent: (id, patch) =>
      set(s => {
        const before = s.data.clubEvents.find(x => x.id === id);
        if (!before) return s;
        const after: ClubEvent = { ...before, ...patch };
        remote({ kind: 'clubevent.upsert', clubEvent: after });
        return {
          data: persist({
            ...s.data,
            clubEvents: s.data.clubEvents.map(x => (x.id === id ? after : x)),
          }),
        };
      }),

    deleteClubEvent: id =>
      set(s => {
        remote({ kind: 'clubevent.delete', id });
        return {
          data: persist({
            ...s.data,
            clubEvents: s.data.clubEvents.filter(x => x.id !== id),
          }),
        };
      }),

    addAnnouncement: a => {
      const ann: Announcement = { ...a, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, announcements: [...s.data.announcements, ann] },
            'announcement.create',
            'metier',
            'announcement',
            `Annonce « ${a.title} » publiée.`,
            { targetId: ann.id }
          )
        ),
      }));
      remote({ kind: 'announcement.upsert', announcement: ann });
      return ann.id;
    },

    updateAnnouncement: (id, patch) =>
      set(s => {
        const before = s.data.announcements.find(x => x.id === id);
        if (!before) return s;
        const after: Announcement = { ...before, ...patch };
        remote({ kind: 'announcement.upsert', announcement: after });
        return {
          data: persist({
            ...s.data,
            announcements: s.data.announcements.map(x =>
              x.id === id ? after : x
            ),
          }),
        };
      }),

    deleteAnnouncement: id =>
      set(s => {
        remote({ kind: 'announcement.delete', id });
        return {
          data: persist({
            ...s.data,
            announcements: s.data.announcements.filter(x => x.id !== id),
          }),
        };
      }),

    addTournament: t => {
      const tournament: Tournament = { ...t, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, tournaments: [...s.data.tournaments, tournament] },
            'tournament.create',
            'metier',
            'tournament',
            `Tournoi « ${t.name} » créé.`,
            { targetId: tournament.id }
          )
        ),
      }));
      remote({ kind: 'tournament.upsert', tournament });
      return tournament.id;
    },

    updateTournament: (id, patch) =>
      set(s => {
        const before = s.data.tournaments.find(x => x.id === id);
        if (!before) return s;
        const after: Tournament = { ...before, ...patch };
        remote({ kind: 'tournament.upsert', tournament: after });
        return {
          data: persist({
            ...s.data,
            tournaments: s.data.tournaments.map(x => (x.id === id ? after : x)),
          }),
        };
      }),

    deleteTournament: id =>
      set(s => {
        remote({ kind: 'tournament.delete', id });
        return {
          data: persist({
            ...s.data,
            tournaments: s.data.tournaments.filter(x => x.id !== id),
          }),
        };
      }),

    addTrainingSession: sess => {
      const session: TrainingSession = { ...sess, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            {
              ...s.data,
              trainingSessions: [...s.data.trainingSessions, session],
            },
            'session.create',
            'metier',
            'session',
            `Séance du ${session.date} ajoutée.`,
            { targetId: session.id }
          )
        ),
      }));
      remote({ kind: 'session.upsert', session });
      return session.id;
    },

    updateTrainingSession: (id, patch) =>
      set(s => {
        const before = s.data.trainingSessions.find(x => x.id === id);
        if (!before) return s;
        const after: TrainingSession = { ...before, ...patch };
        remote({ kind: 'session.upsert', session: after });
        return {
          data: persist({
            ...s.data,
            trainingSessions: s.data.trainingSessions.map(x =>
              x.id === id ? after : x
            ),
          }),
        };
      }),

    deleteTrainingSession: id =>
      set(s => {
        remote({ kind: 'session.delete', id });
        return {
          data: persist({
            ...s.data,
            trainingSessions: s.data.trainingSessions.filter(x => x.id !== id),
          }),
        };
      }),

    addExercise: e => {
      const exercise: Exercise = { ...e, id: createUuid() };
      set(s => ({
        data: persist(
          audit(
            { ...s.data, exercises: [...s.data.exercises, exercise] },
            'exercise.create',
            'metier',
            'exercise',
            `Exercice « ${e.name} » ajouté.`,
            { targetId: exercise.id }
          )
        ),
      }));
      remote({ kind: 'exercise.upsert', exercise });
      return exercise.id;
    },

    updateExercise: (id, patch) =>
      set(s => {
        const before = s.data.exercises.find(x => x.id === id);
        if (!before) return s;
        const after: Exercise = { ...before, ...patch };
        remote({ kind: 'exercise.upsert', exercise: after });
        return {
          data: persist({
            ...s.data,
            exercises: s.data.exercises.map(x => (x.id === id ? after : x)),
          }),
        };
      }),

    deleteExercise: id =>
      set(s => {
        remote({ kind: 'exercise.delete', id });
        return {
          data: persist({
            ...s.data,
            exercises: s.data.exercises.filter(x => x.id !== id),
          }),
        };
      }),

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

    wipeLocal: () => {
      // Vide la file de synchro (rien ne doit être rejoué pour un autre compte)
      // puis réinitialise le miroir local. Le prochain login re-pull le serveur.
      clearSyncQueue();
      set({
        data: persist(createEmptyData()),
        syncStatus: { state: 'idle' },
      });
    },
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
