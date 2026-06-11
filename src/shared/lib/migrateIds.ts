/**
 * Migration des identifiants hérités vers des UUID.
 *
 * Les entités SYNCHRONISABLES (saisons, événements, écritures, récurrences,
 * adhérents, vie du club…) ont une clé primaire `uuid` côté Supabase ; leur
 * identifiant local DOIT donc être un UUID pour que l'upsert idempotent
 * fonctionne (cf. [[id]] et `supabase/migrations/0001_schema.sql`).
 *
 * Les anciens jeux de données (seed v1) portaient des ids courts non-UUID
 * (« sea_be775a20 », « ev_… ») qui faisaient échouer la synchronisation avec
 * « invalid input syntax for type uuid ». Cette migration les réécrit en UUID
 * et propage le remappage à toutes les clés étrangères. Idempotente : un id
 * déjà au format UUID est laissé intact.
 */
import { createUuid } from './id.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Collections dont la clé primaire est un `uuid` côté Postgres. */
const UUID_PK_COLLECTIONS = [
  'seasons',
  'events',
  'entries',
  'recurrings',
  'adherents',
  'clubEvents',
  'announcements',
  'tournaments',
  'trainingSessions',
  'exercises',
  'strategies',
  'referees',
  'photoAlbums',
  'guardians',
] as const;

/** Clé étrangère simple → collection cible (réécrite via le remappage). */
const FK_FIELDS: Record<string, string[]> = {
  seasonId: [
    'entries',
    'events',
    'adherents',
    'clubEvents',
    'announcements',
    'tournaments',
    'trainingSessions',
    'exercises',
    'strategies',
    'referees',
    'photoAlbums',
  ],
  eventId: ['entries', 'tournaments'],
  memberId: ['guardians'],
  coachId: ['trainingSessions'],
};

type Loose = Record<string, unknown>;

/**
 * Réécrit en UUID tout identifiant non-UUID des entités synchronisables et
 * propage le remappage aux références. Mute et renvoie l'objet fourni (le
 * snapshot relu du stockage, jetable). Sans rien à corriger, renvoie l'entrée
 * telle quelle.
 */
export function remapNonUuidSyncIds<T>(input: T): T {
  if (!input || typeof input !== 'object') return input;
  const data = input as Loose;
  const idMap = new Map<string, string>();

  // Passe 1 — réaffecte les ids propres non-UUID (old → new).
  for (const key of UUID_PK_COLLECTIONS) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === 'object' && !isUuid((item as Loose).id)) {
        const old = (item as Loose).id;
        if (typeof old !== 'string') continue;
        const next = createUuid();
        idMap.set(old, next);
        (item as Loose).id = next;
      }
    }
  }
  if (idMap.size === 0) return input; // rien à corriger

  // Référence remappée si — et seulement si — elle pointe vers une entité
  // effectivement réécrite (un id déjà UUID ou pendant reste tel quel).
  const ref = (value: unknown): unknown =>
    typeof value === 'string' && idMap.has(value) ? idMap.get(value)! : value;

  // Passe 2 — propage aux clés étrangères.
  if (typeof data.activeSeasonId === 'string')
    data.activeSeasonId = ref(data.activeSeasonId);

  for (const [field, collections] of Object.entries(FK_FIELDS)) {
    for (const collection of collections) {
      const list = data[collection];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (item && typeof item === 'object' && field in (item as Loose))
          (item as Loose)[field] = ref((item as Loose)[field]);
      }
    }
  }

  // Références imbriquées : présences (adhérents) et plan (exercices).
  const sessions = data.trainingSessions;
  if (Array.isArray(sessions)) {
    for (const s of sessions) {
      const session = s as Loose;
      if (Array.isArray(session.attendance))
        session.attendance = session.attendance.map(ref);
      if (Array.isArray(session.plan)) {
        for (const item of session.plan) {
          if (item && typeof item === 'object' && 'exerciseId' in item)
            (item as Loose).exerciseId = ref((item as Loose).exerciseId);
        }
      }
    }
  }

  return input;
}
