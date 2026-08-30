import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/index.ts';
import { SocleLabels } from '../i18n/SocleLabels.tsx';
import { UpdatePrompt } from './UpdatePrompt.tsx';

/**
 * Le bandeau de mise à jour PEUT-IL S'AFFICHER ?
 *
 * Ce n'est pas une question rhétorique. Le bandeau du socle ne découvre une
 * nouvelle version que par le `registerSW` qu'on lui INJECTE : sans cette
 * prop, il compile, il se monte, il ne dit jamais rien — une bannière muette
 * qu'aucun type ni aucun test d'existence ne signale. Le stub partagé de
 * `vitest-setup` (`registerSW: () => () => {}`) n'appelle jamais
 * `onNeedRefresh` : il faut donc le remplacer ici par un faux PILOTABLE, qui
 * capture les rappels et les déclenche à la demande.
 *
 * On rend le composant de l'app — pas celui du socle — pour que la chaîne
 * testée soit exactement celle qui tourne en production, injection comprise.
 */

type RegisterOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

/** Options confiées au `registerSW` par le socle, pour le test en cours. */
let captured: RegisterOptions | undefined;

/**
 * Le `registerSW` exposé par le module virtuel. RENOUVELÉ à chaque test : le
 * socle mémorise sa connexion PAR fonction injectée (WeakMap, pour ne pas
 * enregistrer deux fois sous StrictMode), donc une identité stable d'un test à
 * l'autre ferait fuiter `needRefresh` d'un cas vers le suivant.
 */
let registerSWImpl: (options: RegisterOptions) => () => Promise<void>;

vi.mock('virtual:pwa-register', () => ({
  get registerSW() {
    return registerSWImpl;
  },
}));

function renderPrompt(locale: 'fr' | 'en' = 'fr') {
  localStorage.setItem('uwh_locale', locale);
  return render(
    <I18nProvider>
      <SocleLabels>
        <UpdatePrompt />
      </SocleLabels>
    </I18nProvider>
  );
}

/** Le service worker annonce qu'une nouvelle version attend. */
function announceUpdate() {
  expect(captured?.onNeedRefresh).toBeTypeOf('function');
  act(() => captured!.onNeedRefresh!());
}

beforeEach(() => {
  captured = undefined;
  registerSWImpl = options => {
    captured = options;
    return () => Promise.resolve();
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('UpdatePrompt', () => {
  it('injecte registerSW et se tait tant qu’aucune version n’attend', () => {
    renderPrompt();

    // L'injection a bien eu lieu : le socle a pu poser ses écouteurs.
    expect(captured?.onNeedRefresh).toBeTypeOf('function');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('affiche le bandeau quand une mise à jour est disponible', () => {
    renderPrompt();
    announceUpdate();

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    // L'habillage partagé s'accroche à cet attribut (components.css).
    expect(banner).toHaveAttribute('data-dwc', 'update-banner');
    expect(
      screen.getByText('Une nouvelle version de Miss UWH est prête.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recharger' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Plus tard' })
    ).toBeInTheDocument();
  });

  it('offre toujours une sortie : « Plus tard » referme le bandeau', async () => {
    const user = userEvent.setup();
    renderPrompt();
    announceUpdate();

    await user.click(screen.getByRole('button', { name: 'Plus tard' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('suit la langue de l’application', () => {
    renderPrompt('en');
    announceUpdate();

    expect(
      screen.getByText('A new version of Miss UWH is ready.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });
});
