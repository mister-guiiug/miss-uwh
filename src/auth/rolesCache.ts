import type { Role } from './useAuth.ts';

/**
 * LES RÔLES DU MEMBRE, GARDÉS SUR L'APPAREIL.
 *
 * POURQUOI. Les rôles sont lus dans la table `members`, donc par le réseau.
 * Hors ligne, cette lecture ne peut pas aboutir — et l'amorçage retombait
 * alors sur un tableau vide, c'est-à-dire sur une application qui, au retour
 * d'un membre du bureau, lui cache le lanceur, les compétences et la moitié
 * des réglages. Une rétrogradation apparente, causée par l'absence de réseau.
 *
 * CE N'EST PAS UNE AUTORISATION. Les rôles gardent des AFFORDANCES : quels
 * boutons proposer. Ce que le membre a le droit d'écrire est arbitré par la
 * RLS, côté serveur, à partir de son jeton — jamais à partir de ce cache. Un
 * rôle révoqué pendant la coupure fera donc apparaître un bouton dont l'action
 * sera refusée au retour du réseau, ce qui est exactement ce qui se passe déjà
 * quand un rôle change pendant qu'un écran est ouvert.
 *
 * BEST-EFFORT : navigation privée, stockage refusé, contenu illisible — tout
 * rend un tableau vide, comme avant ce cache.
 */
const PREFIXE = 'uwh_roles:';

/** Les rôles connus pour cet identifiant, ou `[]`. */
export function rolesEnCache(userId: string): Role[] {
  try {
    const brut = globalThis.localStorage?.getItem(PREFIXE + userId);
    if (!brut) return [];
    const valeur: unknown = JSON.parse(brut);
    return Array.isArray(valeur)
      ? valeur.filter((r): r is Role => typeof r === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Retient les rôles lus au serveur, pour la prochaine ouverture sans réseau. */
export function retenirRoles(userId: string, roles: Role[]): void {
  try {
    globalThis.localStorage?.setItem(PREFIXE + userId, JSON.stringify(roles));
  } catch {
    /* stockage refusé : on se passera de cache */
  }
}

/**
 * Oublie tout. Appelé à la DÉCONNEXION, avec le reste des données locales :
 * l'appareil peut être partagé — un vestiaire, un poste de club — et les rôles
 * du membre qui part n'ont rien à faire dans la session du suivant.
 */
export function oublierRoles(): void {
  try {
    const stockage = globalThis.localStorage;
    if (!stockage) return;
    const aRetirer: string[] = [];
    for (let i = 0; i < stockage.length; i++) {
      const nom = stockage.key(i);
      if (nom?.startsWith(PREFIXE)) aRetirer.push(nom);
    }
    for (const nom of aRetirer) stockage.removeItem(nom);
  } catch {
    /* best-effort */
  }
}
