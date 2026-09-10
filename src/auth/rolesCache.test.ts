import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { oublierRoles, retenirRoles, rolesEnCache } from './rolesCache.ts';
import type { Role } from './useAuth.ts';

/**
 * CE CACHE DÉCIDE DE CE QU'UN MEMBRE VOIT QUAND IL OUVRE L'APPLICATION SANS
 * RÉSEAU. Les rôles sont lus dans la table `members`, donc par le réseau :
 * sans eux, l'amorçage retombait sur un tableau vide — le lanceur, les
 * compétences et la moitié des réglages disparaissaient, comme si le membre
 * avait été rétrogradé pendant la nuit.
 */
const UID = 'auth-1';
const BUREAU = ['bureau', 'coach'] as unknown as Role[];

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('les rôles gardés sur l’appareil', () => {
  it('reviennent tels qu’ils ont été retenus', () => {
    retenirRoles(UID, BUREAU);
    expect(rolesEnCache(UID)).toEqual(BUREAU);
  });

  it('sont propres à un membre — pas de fuite d’un compte à l’autre', () => {
    // Poste partagé : le vestiaire, l'ordinateur du club.
    retenirRoles(UID, BUREAU);
    expect(rolesEnCache('auth-2')).toEqual([]);
  });

  it('valent `[]` quand rien n’a jamais été retenu', () => {
    expect(rolesEnCache(UID)).toEqual([]);
  });

  it('valent `[]` sur un contenu illisible, sans lever', () => {
    localStorage.setItem('uwh_roles:' + UID, 'ceci n’est pas du JSON');
    expect(rolesEnCache(UID)).toEqual([]);
  });

  it('ignorent ce qui n’est pas une liste de chaînes', () => {
    localStorage.setItem('uwh_roles:' + UID, JSON.stringify({ bureau: true }));
    expect(rolesEnCache(UID)).toEqual([]);
    localStorage.setItem('uwh_roles:' + UID, JSON.stringify(['bureau', 42]));
    expect(rolesEnCache(UID)).toEqual(['bureau']);
  });

  it('sont OUBLIÉS à la déconnexion, pour tous les comptes', () => {
    // L'appareil peut être partagé : les rôles du membre qui part n'ont rien
    // à faire dans la session du suivant.
    retenirRoles(UID, BUREAU);
    retenirRoles('auth-2', ['coach'] as unknown as Role[]);
    localStorage.setItem('autre-chose', 'à garder');

    oublierRoles();

    expect(rolesEnCache(UID)).toEqual([]);
    expect(rolesEnCache('auth-2')).toEqual([]);
    // On n'emporte que ce qui nous appartient.
    expect(localStorage.getItem('autre-chose')).toBe('à garder');
  });
});
