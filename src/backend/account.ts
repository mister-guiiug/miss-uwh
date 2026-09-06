/**
 * Supprimer son compte (RGPD art. 17) — l'appel, et rien d'autre.
 *
 * CE QUI EXISTAIT. `wipeLocal` (store/slices/systemSlice.ts) vide le MIROIR du
 * navigateur. Il est appelé à chaque déconnexion, parce que l'appareil peut
 * être partagé — mais le compte Supabase, la ligne `members` et l'adresse
 * recopiée dans les journaux d'audit restaient sur le serveur. Un membre qui
 * quitte le club n'avait, pour être effacé, qu'un message à écrire au
 * mainteneur.
 *
 * TOUT LE TRAVAIL EST SERVEUR (`supabase/migrations/0018_suppression_compte.
 * sql`). Le faire ici serait impossible : la RLS n'ouvre `members` en écriture
 * qu'à un administrateur, les journaux d'audit sont en ajout seul, et
 * `auth.users` est hors de portée du rôle `authenticated`. Le client ne fait
 * donc que déclencher et rapporter.
 *
 * MODE LOCAL : cette fonction n'existe pas pour lui. Sans backend, l'app est
 * entière et il n'y a aucun compte à supprimer — la carte des réglages ne
 * s'affiche pas, et `assertSupabase` est là pour que l'erreur soit lisible si
 * cet invariant se rompait un jour.
 */
import { IS_SUPABASE } from './config.ts';
import { getSupabase } from '../lib/supabase.ts';

/**
 * Ce que le serveur a réellement fait de la ligne `members` :
 *
 * - `supprime`  — elle n'était référencée nulle part : elle a disparu.
 * - `anonymise` — elle signe des écritures, une clôture ou une ligne d'audit,
 *   c'est-à-dire les livres du CLUB, que l'association conserve. La ligne
 *   reste, vidée de toute donnée personnelle.
 *
 * Le compte d'authentification, lui, est supprimé dans les deux cas. La
 * distinction est remontée jusqu'à l'écran : promettre « plus rien de vous »
 * quand une signature anonyme subsiste serait un mensonge de plus.
 */
export type DeleteAccountOutcome = 'supprime' | 'anonymise';

export class DeleteAccountError extends Error {
  /**
   * `42501` quand le serveur refuse (dernier administrateur du club, ou appel
   * sans session) — le seul cas où le message du serveur est destiné à être
   * lu par un humain.
   */
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DeleteAccountError';
    this.code = code;
  }
}

/**
 * Appelle `delete_my_account()`. Lève `DeleteAccountError` si le serveur
 * refuse — jamais silencieusement : un effacement qui échoue sans le dire
 * laisse la personne convaincue d'avoir disparu.
 */
export async function deleteMyAccount(): Promise<DeleteAccountOutcome> {
  if (!IS_SUPABASE) {
    throw new DeleteAccountError('Aucun compte : mode local.');
  }
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('delete_my_account');
  if (error) {
    throw new DeleteAccountError(
      error.message,
      (error as { code?: string }).code
    );
  }
  return data === 'anonymise' ? 'anonymise' : 'supprime';
}
