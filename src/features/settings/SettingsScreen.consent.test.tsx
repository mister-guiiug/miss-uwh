import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  isAnalyticsLoaded,
  resetAnalytics,
} from '@mister-guiiug/dev-pwa-config/analytics';
import {
  readConsentChoice,
  writeConsentChoice,
} from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { CLE_DE_TEST } from '@mister-guiiug/dev-pwa-config/testing/posthog';
import { I18nProvider } from '../../i18n/index.ts';
import { SocleLabels } from '../../i18n/SocleLabels.tsx';

/**
 * REVENIR SUR SON CHOIX DE MESURE D'AUDIENCE, DEPUIS LES RÉGLAGES.
 *
 * Le bandeau recueille l'accord ; rien ne permettait de le retirer, sinon
 * d'effacer les données du site. L'article 7.3 du RGPD veut que retirer soit
 * aussi simple que donner : un clic, ici. Le VRAI écran est monté, pour tenir
 * aussi ce que le socle ne voit pas : la section rangée dans la liste qui
 * nourrit la recherche et la navigation rapide, et ses libellés dans la
 * langue de l'app.
 */

// La vraie bibliothèque, initialisée dans jsdom, partirait interroger PostHog.
vi.mock('posthog-js/dist/module.slim.js', async () => {
  const { fauxPosthog } =
    await import('@mister-guiiug/dev-pwa-config/testing/posthog');
  return { default: fauxPosthog() };
});

// `useAuth` lève hors d'`AuthProvider` ; en mode local, l'écran n'en lit que
// les rôles et la déconnexion.
vi.mock('../../auth/useAuth.ts', () => ({
  useAuth: () => ({ roles: [], signOut: vi.fn() }),
}));

const { SettingsScreen } = await import('./SettingsScreen.tsx');

function mount(locale: 'fr' | 'en' = 'fr') {
  localStorage.setItem('uwh_locale', locale);
  render(
    <I18nProvider>
      <SocleLabels>
        <MemoryRouter>
          <SettingsScreen />
        </MemoryRouter>
      </SocleLabels>
    </I18nProvider>
  );
}

beforeEach(() => {
  // Le setup partagé ne vide pas le stockage : un choix fuirait d'un test à
  // l'autre.
  localStorage.clear();
  vi.stubEnv('VITE_POSTHOG_KEY', CLE_DE_TEST);
  // L'état de la mesure est celui d'un module : il survit d'un test à l'autre.
  resetAnalytics();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('réglages : la mesure d’audience', () => {
  it('permettent de retirer son consentement, en un clic', async () => {
    writeConsentChoice('granted');
    mount();

    const titre = await screen.findByRole('heading', {
      name: 'Mesure d’audience',
    });
    const section = titre.closest('section')!;
    expect(
      screen.getByRole('region', { name: 'Confidentialité' })
    ).toContainElement(section);
    expect(within(section).getByRole('status')).toHaveTextContent(
      'Vous avez accepté cette mesure.'
    );
    // L'accord d'hier, rejoué au montage, a chargé la bibliothèque.
    await waitFor(() => expect(isAnalyticsLoaded()).toBe(true));

    fireEvent.click(
      within(section).getByRole('button', { name: 'Retirer mon consentement' })
    );

    expect(readConsentChoice()).toBe('denied');
    const posthog = (await import('posthog-js/dist/module.slim.js')).default;
    expect(posthog.has_opted_out_capturing()).toBe(true);
    expect(within(section).getByRole('status')).toHaveTextContent(
      'Vous avez refusé cette mesure.'
    );
  });

  it('parlent la langue de l’app : en anglais, « Withdraw my consent »', async () => {
    writeConsentChoice('granted');
    mount('en');

    const region = screen.getByRole('region', { name: 'Privacy' });
    expect(
      await within(region).findByRole('heading', {
        name: 'Audience measurement',
      })
    ).toBeInTheDocument();
    expect(
      within(region).getByRole('button', { name: 'Withdraw my consent' })
    ).toBeInTheDocument();
    // Le chargement rejoué s'achève ICI, et non dans le test suivant.
    await waitFor(() => expect(isAnalyticsLoaded()).toBe(true));
  });

  it('sans identifiant de mesure : ni section, ni puce de navigation', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    mount();

    const nav = screen.getByRole('navigation', {
      name: 'Sections des réglages',
    });
    // Le voisin est là : l'écran est bien monté.
    expect(
      within(nav).getByRole('button', { name: 'Sécurité' })
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: 'Confidentialité' })
    ).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Confidentialité' })
    ).toBeNull();
  });
});
