import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ce que ces tests pincent, et qu'une relecture laisse passer : le NOM de la
 * RPC. Une faute de frappe ici ne casse aucune compilation, ne lève aucune
 * alerte, et se découvre le jour où quelqu'un demande son effacement.
 *
 * Et la propagation du CODE : l'écran distingue un refus lisible du serveur
 * (42501 — dernier administrateur du club) d'une panne quelconque, et n'affiche
 * le message brut du serveur que dans le premier cas. Sans le code, il
 * afficherait du SQL à un trésorier, ou avalerait la seule explication utile.
 */

const rpc = vi.fn();
vi.mock('../lib/supabase.ts', () => ({
  getSupabase: () => Promise.resolve({ rpc }),
  supabase: { isConfigured: () => true },
}));
vi.mock('./config.ts', () => ({ IS_SUPABASE: true, BACKEND: 'supabase' }));

const { DeleteAccountError, deleteMyAccount } = await import('./account.ts');

beforeEach(() => rpc.mockReset());

describe('deleteMyAccount', () => {
  it('appelle delete_my_account et rend « supprime »', async () => {
    rpc.mockResolvedValue({ data: 'supprime', error: null });
    await expect(deleteMyAccount()).resolves.toBe('supprime');
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
  });

  it('rend « anonymise » quand la signature comptable survit', async () => {
    rpc.mockResolvedValue({ data: 'anonymise', error: null });
    await expect(deleteMyAccount()).resolves.toBe('anonymise');
  });

  it('lève avec le code du serveur — jamais en silence', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'dernier administrateur du club', code: '42501' },
    });
    await expect(deleteMyAccount()).rejects.toMatchObject({
      name: 'DeleteAccountError',
      code: '42501',
      message: 'dernier administrateur du club',
    });
    expect(DeleteAccountError).toBeTypeOf('function');
  });
});
