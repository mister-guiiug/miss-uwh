import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
import type { QueueItem } from '../../backend/syncQueue.ts';

/**
 * LA RÉCUPÉRATION D'UNE MODIFICATION REFUSÉE, VUE DE L'ÉCRAN. Ce que la
 * synchro fait des deux gestes est tenu par `sync.occ.test.ts` ; ici, ce que
 * l'utilisateur LIT et ce qu'il peut FAIRE :
 *  - un conflit se dit « modifiée ailleurs », pas par un message SQL, et
 *    propose les deux gestes ;
 *  - un refus de droits se dit comme tel, avec les mêmes gestes ;
 *  - les boutons de chaque ligne disent de QUELLE écriture il s'agit (un
 *    lecteur d'écran en rencontre plusieurs portant le même libellé) ;
 *  - un geste qui échoue hors ligne le dit, sans prétendre avoir agi.
 */

// Le mode est épinglé : la liste des refus n'existe qu'en mode Supabase.
vi.mock('../../backend/config.ts', () => ({
  BACKEND: 'supabase',
  IS_SUPABASE: true,
}));

const keepServerVersion = vi.fn<(id: string) => Promise<'done' | 'gone'>>();
const reapplyMyChange = vi.fn<(id: string) => Promise<string>>();
vi.mock('../../backend/sync.ts', () => ({
  keepServerVersion: (id: string) => keepServerVersion(id),
  reapplyMyChange: (id: string) => reapplyMyChange(id),
  retryDeadOps: vi.fn(),
  retrySync: vi.fn(),
  discardDeadOps: vi.fn(),
}));

const { DatabaseStatusCard } = await import('./DatabaseStatusCard.tsx');

const DEAD_KEY = 'miss-uwh:syncdead';

function morte(
  id: string,
  payload: QueueItem['payload'],
  lastError: string
): QueueItem {
  return {
    id,
    key: null,
    payload,
    attempts: 1,
    enqueuedAt: '2026-09-25T08:00:00.000Z',
    lastError,
  };
}

const modification = (id: string, label: string): QueueItem['payload'] => ({
  kind: 'entry.update',
  id,
  label,
  expectedVersion: 1,
  patch: { label },
});

function mount(items: QueueItem[]) {
  localStorage.setItem(DEAD_KEY, JSON.stringify(items));
  useAppStore.setState({
    syncStatus: { state: 'error', dead: items.length, pending: 0 },
  });
  render(
    <I18nProvider>
      <SocleLabels>
        <DatabaseStatusCard />
      </SocleLabels>
    </I18nProvider>
  );
}

const toasts = () => useToasts.getState().toasts;

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  keepServerVersion.mockReset();
  reapplyMyChange.mockReset();
  useToasts.getState().clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('État de la base de données — opérations refusées', () => {
  it('un conflit se dit « modifiée ailleurs » et propose les deux gestes, décrits par la ligne', () => {
    mount([
      morte(
        'q1',
        modification('e1', 'Cotisations'),
        "[40001] Conflit de version sur l'écriture e1 (rechargez)."
      ),
    ]);

    expect(screen.getByText(/Modifiée ailleurs entre-temps/)).toBeTruthy();
    // Le message SQL n'est pas montré à la place de la raison.
    expect(screen.queryByText(/rechargez/)).toBeNull();
    const description = /Modification de l’écriture « Cotisations »/;
    expect(
      screen.getByRole('button', {
        name: 'Garder la version du serveur',
        description,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Réappliquer ma modification',
        description,
      })
    ).toBeTruthy();
  });

  it('un refus de droits le dit, avec les mêmes deux gestes', () => {
    mount([
      morte(
        'q1',
        modification('e1', 'Location bassin'),
        '[42501] Écriture e1 introuvable, ou droits insuffisants pour la modifier.'
      ),
    ]);

    expect(screen.getByText(/vos droits ne permettent pas/)).toBeTruthy();
    const description = /Modification de l’écriture « Location bassin »/;
    expect(
      screen.getByRole('button', {
        name: 'Garder la version du serveur',
        description,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Réappliquer ma modification',
        description,
      })
    ).toBeTruthy();
  });

  it('un autre refus garde son message, sans geste par ligne', () => {
    mount([
      morte(
        'q1',
        { kind: 'event.delete', id: 'ev1' },
        'permission denied (RLS)'
      ),
    ]);

    expect(screen.getByText('permission denied (RLS)')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Garder la version du serveur' })
    ).toBeNull();
  });

  it('« Réappliquer ma modification » appelle la synchro et dit l’issue', async () => {
    reapplyMyChange.mockResolvedValue('done');
    mount([
      morte(
        'q1',
        modification('e1', 'Cotisations'),
        '[40001] Conflit de version'
      ),
    ]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Réappliquer ma modification' })
    );

    await waitFor(() =>
      expect(toasts().map(t => t.message)).toContain(
        'Modification réappliquée sur la version du serveur.'
      )
    );
    expect(reapplyMyChange).toHaveBeenCalledWith('e1');
  });

  it('un nouveau conflit pendant la réapplication est dit comme tel', async () => {
    reapplyMyChange.mockResolvedValue('conflict');
    mount([morte('q1', modification('e1', 'Cotisations'), '[40001] Conflit')]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Réappliquer ma modification' })
    );

    await waitFor(() =>
      expect(toasts().find(t => t.tone === 'error')?.message).toMatch(
        /encore changé/
      )
    );
  });

  it('« Garder la version du serveur » hors ligne : rien n’a changé, et c’est dit', async () => {
    keepServerVersion.mockRejectedValue(new Error('Failed to fetch'));
    mount([morte('q1', modification('e1', 'Cotisations'), '[40001] Conflit')]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Garder la version du serveur' })
    );

    await waitFor(() =>
      expect(toasts().find(t => t.tone === 'error')?.message).toMatch(
        /rien n’a changé/
      )
    );
    expect(keepServerVersion).toHaveBeenCalledWith('e1');
  });

  it('« Garder la version du serveur » réussi nomme l’écriture', async () => {
    keepServerVersion.mockResolvedValue('done');
    mount([morte('q1', modification('e1', 'Cotisations'), '[40001] Conflit')]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Garder la version du serveur' })
    );

    await waitFor(() =>
      expect(toasts().find(t => t.tone === 'success')?.message).toBe(
        'Version du serveur rétablie : Modification de l’écriture « Cotisations ».'
      )
    );
  });
});
