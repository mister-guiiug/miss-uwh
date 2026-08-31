import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/index.ts';
import { SocleLabels } from '../i18n/SocleLabels.tsx';
import { useAppStore } from '../store/useAppStore.ts';

/**
 * LE TROU QUE CE FICHIER TIENT.
 *
 * Miss UWH avait déjà tout ce qu'il faut : la file de synchronisation du socle,
 * et un bandeau qui distingue « hors ligne » de « serveur injoignable ». Sauf
 * que `onOffline()` appelle `reportQueueStatus()`, qui rend `ready` quand la
 * file est VIDE — et le bandeau rendait `null` sur `ready`. Autrement dit :
 * couper le réseau sans rien avoir en attente, le cas de très loin le plus
 * fréquent (on consulte un bilan dans un gymnase), n'affichait STRICTEMENT
 * RIEN. L'app ne disait « hors ligne » qu'à ceux qui avaient déjà écrit.
 *
 * Ce qui est éprouvé ici est l'usage : ce que voit quelqu'un dont le réseau
 * tombe, selon qu'il a ou non des modifications en attente — et le fait qu'il
 * n'y ait JAMAIS deux bandeaux à la fois sous l'en-tête.
 */

// Le mode est épinglé : sur cette machine un `.env` peut activer Supabase, en
// CI non. Un test qui dépend de l'environnement ne prouve rien.
vi.mock('./config.ts', () => ({ BACKEND: 'supabase', IS_SUPABASE: true }));
// Les boutons du bandeau appellent le moteur de synchro ; on ne teste pas le
// moteur ici, et l'importer tirerait le SDK Supabase.
vi.mock('./sync.ts', () => ({
  retrySync: vi.fn(),
  retryDeadOps: vi.fn(),
}));

const { SyncBanner } = await import('./SyncBanner.tsx');

function mount() {
  render(
    <MemoryRouter>
      <I18nProvider>
        <SocleLabels>
          <SyncBanner />
        </SocleLabels>
      </I18nProvider>
    </MemoryRouter>
  );
}

const connectionBanner = () =>
  document.querySelector('[data-dwc="connection-banner"]');

function setSync(status: {
  state: 'idle' | 'syncing' | 'ready' | 'offline' | 'error';
  pending?: number;
  dead?: number;
}) {
  act(() => {
    useAppStore.setState({ syncStatus: status });
  });
}

function goOffline() {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}
function goOnline() {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  useAppStore.setState({ syncStatus: { state: 'idle' } });
  localStorage.clear();
});

describe('file vide : le réseau est enfin annoncé, mais pas au premier clignotement', () => {
  beforeEach(() => {
    // Rien n'attend : l'état que `reportQueueStatus` produit dans ce cas.
    setSync({ state: 'ready' });
  });

  it('en ligne : rien ne s’affiche', () => {
    mount();
    expect(connectionBanner()).toBeNull();
  });

  it('ne dit rien tant que la coupure n’a pas duré', () => {
    mount();
    goOffline();
    expect(connectionBanner()).toBeNull();

    wait(1499);
    expect(connectionBanner()).toBeNull();
  });

  it('ignore une micro-coupure : le gymnase en limite de couverture', () => {
    mount();
    goOffline();
    wait(900);
    expect(connectionBanner()).toBeNull();

    goOnline();
    wait(5000);
    expect(connectionBanner()).toBeNull();
  });

  it('parle après la temporisation, et dit que les données restent là', () => {
    mount();
    goOffline();
    wait(1500);

    const shown = connectionBanner();
    expect(shown).not.toBeNull();
    expect(shown).toHaveAttribute('role', 'status');
    expect(shown).toHaveTextContent(
      'Hors ligne — vos données restent disponibles'
    );
  });

  it('se tait dès le retour du réseau', () => {
    mount();
    goOffline();
    wait(1500);
    expect(connectionBanner()).not.toBeNull();

    goOnline();
    expect(connectionBanner()).toBeNull();
  });
});

describe('jamais deux bandeaux sous l’en-tête', () => {
  it('des modifications en attente : le bandeau de la FILE, et lui seul', () => {
    setSync({ state: 'offline', pending: 3 });
    mount();
    goOffline();
    wait(5000);

    // Le message riche de la file (avec « Réessayer »), pas celui du réseau.
    expect(
      screen.getByText(/3 modification\(s\) en attente/)
    ).toBeInTheDocument();
    expect(connectionBanner()).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('des opérations refusées : le bandeau d’ERREUR, et lui seul', () => {
    setSync({ state: 'error', dead: 2 });
    mount();
    goOffline();
    wait(5000);

    expect(connectionBanner()).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
