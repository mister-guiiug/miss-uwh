/**
 * Contexte club courant (mode Supabase). Renseigné par `sync.ts` après le pull
 * initial ; lu par le store pour rattacher les nouvelles saisons au bon club
 * (colonne `seasons.club_id` non nulle). Module feuille → pas de cycle.
 */
let currentClubId: string | undefined;

export function setCurrentClubId(id: string | undefined): void {
  currentClubId = id;
}

export function getCurrentClubId(): string | undefined {
  return currentClubId;
}
