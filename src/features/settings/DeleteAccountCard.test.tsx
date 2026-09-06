import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { I18nProvider } from '../../i18n/index.ts';
import { SocleLabels } from '../../i18n/SocleLabels.tsx';
import { useAppStore } from '../../store/useAppStore.ts';
import { useToasts } from '../../shared/lib/toasts.ts';
import { DeleteAccountError } from '../../backend/account.ts';

/**
 * CE QUE CES TESTS TIENNENT. Un bouton « Supprimer mon compte » qui marche est
 * facile à écrire ; ce qui est difficile, c'est qu'il ne parte pas tout seul,
 * et qu'il ne MENTE pas quand il échoue. Les quatre modes d'échec redoutés :
 *
 *  - partir sur un « OK » réflexe, sans que la personne ait lu la boîte ;
 *  - être proposé hors ligne, puis échouer, laissant la personne sans savoir
 *    si son compte a été touché ;
 *  - annoncer « supprimé » quand le serveur a refusé ;
 *  - annoncer « il ne reste rien de vous » quand une signature comptable
 *    subsiste, anonyme, dans les livres du club.
 */

const deleteMyAccount = vi.fn<() => Promise<'supprime' | 'anonymise'>>();
vi.mock('../../backend/account.ts', async () => {
  const actual = await vi.importActual<
    typeof import('../../backend/account.ts')
  >('../../backend/account.ts');
  return { ...actual, deleteMyAccount: () => deleteMyAccount() };
});

const signOut = vi.fn(() => Promise.resolve());
vi.mock('../../auth/useAuth.ts', () => ({
  useAuth: () => ({ signOut }),
}));

const { DeleteAccountCard } = await import('./DeleteAccountCard.tsx');

const wipeLocal = vi.fn();

function mount() {
  render(
    <I18nProvider>
      <SocleLabels>
        <DeleteAccountCard clubName="Clermont Hockey Sub" />
      </SocleLabels>
    </I18nProvider>
  );
}

/** Le bouton de la carte (celui des réglages), pas celui de la boîte. */
const cardButton = () =>
  screen.getByRole('button', { name: 'Supprimer mon compte' });

/** Ouvre la boîte et rend le champ de confirmation. */
function openDialog() {
  fireEvent.click(cardButton());
  return screen.getByLabelText(/retapez le nom du club/i);
}

/** Le bouton de confirmation DANS la boîte (`data-dwc="confirm-confirm"`). */
const confirmButton = () =>
  document.querySelector<HTMLButtonElement>('[data-dwc="confirm-confirm"]')!;

const messages = () => useToasts.getState().toasts.map(t => t.message);

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  deleteMyAccount.mockReset();
  deleteMyAccount.mockResolvedValue('supprime');
  signOut.mockClear();
  wipeLocal.mockClear();
  // Le composant lit l'action par sélecteur : on remplace l'action dans le
  // magasin plutôt que de simuler le module entier, dont les autres exports
  // (sélecteurs) sont utilisés ailleurs dans l'arbre.
  useAppStore.setState({ wipeLocal });
  useToasts.getState().clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('supprimer son compte', () => {
  it('ne part pas sur un « OK » : il faut retaper le nom du club', () => {
    mount();
    const field = openDialog();

    fireEvent.change(field, { target: { value: 'Clermont' } });
    fireEvent.click(confirmButton());

    // Rien n'est parti, et la boîte dit POURQUOI plutôt que de rester inerte.
    expect(deleteMyAccount).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(wipeLocal).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ne correspond pas à celui du club'
    );
  });

  it('avec le bon nom : efface, purge le miroir local, puis déconnecte', async () => {
    mount();
    const field = openDialog();

    fireEvent.change(field, {
      target: { value: '  clermont hockey sub  ' }, // casse et espaces tolérées
    });
    fireEvent.click(confirmButton());

    await waitFor(() => expect(deleteMyAccount).toHaveBeenCalledTimes(1));
    // Le miroir est purgé même si la déconnexion échouait : l'appareil peut
    // être celui du club.
    await waitFor(() => expect(wipeLocal).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(messages()).toEqual(['Votre compte a été supprimé.']);
  });

  it('dit la VÉRITÉ quand la signature comptable survit, anonymisée', async () => {
    deleteMyAccount.mockResolvedValue('anonymise');
    mount();
    const field = openDialog();

    fireEvent.change(field, { target: { value: 'Clermont Hockey Sub' } });
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(messages()).toEqual([
        'Votre compte a été supprimé. Votre signature sur les écritures du club a été anonymisée.',
      ])
    );
  });

  it('un refus du serveur est rapporté avec son motif, sans déconnecter', async () => {
    // 42501 : la garde du dernier administrateur (migration 0018). Son message
    // est destiné à être lu — il dit quoi faire.
    deleteMyAccount.mockRejectedValue(
      new DeleteAccountError(
        'dernier administrateur du club : transmettez le rôle avant de supprimer votre compte',
        '42501'
      )
    );
    mount();
    const field = openDialog();

    fireEvent.change(field, { target: { value: 'Clermont Hockey Sub' } });
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(messages()[0]).toContain('dernier administrateur du club')
    );
    // Le compte existe toujours : ni déconnexion, ni purge — le contraire
    // laisserait croire que la suppression a eu lieu.
    expect(signOut).not.toHaveBeenCalled();
    expect(wipeLocal).not.toHaveBeenCalled();
  });

  it('une panne quelconque ne prétend pas avoir effacé', async () => {
    deleteMyAccount.mockRejectedValue(new Error('network'));
    mount();
    const field = openDialog();

    fireEvent.change(field, { target: { value: 'Clermont Hockey Sub' } });
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(messages()).toEqual([
        "Impossible de supprimer le compte. Rien n'a été effacé.",
      ])
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it('hors ligne : on ne DEMANDE même pas', async () => {
    mount();
    // `act` : `useOnline` du socle s'abonne à l'événement, et un
    // `dispatchEvent` hors `act` laisserait l'état périmé — le test serait
    // vert par accident, en testant l'état « en ligne ».
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(cardButton()).toHaveAttribute('aria-disabled', 'true');
    expect(cardButton()).toHaveAttribute(
      'title',
      'Indisponible hors ligne : la suppression se fait sur le serveur.'
    );

    fireEvent.click(cardButton());
    await act(async () => {});

    // Pas de boîte : poser « êtes-vous sûr ? » pour une action qui ne peut pas
    // avoir lieu, puis échouer, est le contraire d'un service.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });
});
