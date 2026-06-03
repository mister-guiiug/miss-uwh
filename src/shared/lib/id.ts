/** Identifiants courts, stables, sans dépendance externe. */
export function createId(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

/**
 * UUID v4 — utilisé pour les entités synchronisables (écritures, saisons,
 * événements) afin que l'identifiant local soit IDENTIQUE à la clé primaire
 * Postgres (insert avec id explicite), ce qui rend l'upsert idempotent.
 */
export function createUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
