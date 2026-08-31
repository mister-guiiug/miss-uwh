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

/**
 * LE DÉFAUT LE PLUS MALHONNÊTE DE L'APP, ET LE SEUL DE SON ESPÈCE.
 *
 * Partout ailleurs, une écriture part dans la file du socle : conservée,
 * rejouée à la reconnexion, comptée par le bandeau. Ici, non. `toggleRole`
 * peint d'abord l'état localement, écrit ensuite EN DIRECT dans `members`, et
 * en cas d'échec se contente d'un `setError` — sans jamais défaire la
 * peinture. Hors connexion, la pastille de rôle reste donc VISIBLEMENT
 * activée alors que rien n'a été écrit. L'administrateur repart convaincu
 * d'avoir nommé un trésorier qui ne l'est pas ; la vérité ne réapparaît qu'au
 * prochain chargement, bien plus tard, sans que personne ne fasse le lien.
 *
 * Ce n'est pas un échec silencieux : c'est pire, c'est un MENSONGE. Le garde
 * refuse avant de peindre — pas de peinture, pas de mensonge.
 */

const update = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));
const from = vi.fn(() => ({
  select: vi.fn(() => ({
    order: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 'm1',
            email: 'tresorier@club.fr',
            display_name: 'Alex',
            roles: ['membre'],
            active: true,
          },
        ],
        error: null,
      })
    ),
  })),
  update,
}));
vi.mock('../../lib/supabase.ts', () => ({
  getSupabase: () => Promise.resolve({ from }),
  supabase: { isConfigured: () => true },
}));

const { MembersRolesScreen } = await import('./MembersRolesScreen.tsx');

function goOffline() {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

async function mount() {
  render(
    <I18nProvider>
      <SocleLabels>
        <MembersRolesScreen />
      </SocleLabels>
    </I18nProvider>
  );
  // Le chargement initial est asynchrone : on attend la première ligne.
  await screen.findByText('Alex');
}

/** La pastille « Trésorier » de la seule ligne affichée. */
const roleChip = () => screen.getByRole('button', { name: 'Trésorier' });

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  update.mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('attribuer un rôle hors connexion ne ment plus', () => {
  it('en ligne : la pastille bascule et l’écriture part', async () => {
    await mount();
    expect(roleChip()).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(roleChip());

    expect(roleChip()).toHaveAttribute('aria-pressed', 'true');
    // Le client Supabase est obtenu de façon asynchrone : l'écriture ne part
    // pas dans le même tour que le clic.
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ roles: ['membre', 'tresorier'] })
    );
  });

  it('hors ligne : la pastille est marquée bloquée et porte son motif', async () => {
    await mount();
    goOffline();

    expect(roleChip()).toHaveAttribute('aria-disabled', 'true');
    expect(roleChip()).toHaveAttribute('title', 'Indisponible hors ligne');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Indisponible hors ligne'
    );
  });

  it('hors ligne : cliquer n’écrit rien ET ne peint rien — c’est tout l’enjeu', async () => {
    await mount();
    goOffline();

    fireEvent.click(roleChip());
    // Laisse passer les micro-tâches : si une écriture partait, elle serait
    // partie ici. Assertion sans cette attente = assertion qui ne prouve rien.
    await act(async () => {});

    expect(update).not.toHaveBeenCalled();
    // Le rôle n'est PAS affiché comme accordé : l'écran dit la vérité.
    expect(roleChip()).toHaveAttribute('aria-pressed', 'false');
  });

  it('hors ligne : la bascule d’activation du compte est bloquée elle aussi', async () => {
    await mount();
    goOffline();

    const activeToggle = screen.getByRole('button', {
      name: 'Désactiver le compte',
    });
    expect(activeToggle).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(activeToggle);
    await act(async () => {});
    expect(update).not.toHaveBeenCalled();
  });
});
