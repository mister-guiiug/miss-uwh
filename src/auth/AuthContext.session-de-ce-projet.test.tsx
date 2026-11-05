import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/index.ts';
import { SocleLabels } from '../i18n/SocleLabels.tsx';

/**
 * HORS LIGNE, LA SESSION DE CE PROJET — JAMAIS CELLE D'UNE AUTRE APP.
 *
 * Toute la famille est servie depuis la même origine, donc le même
 * `localStorage`. Sans le client, le socle lisait la première case
 * `sb-*-auth-token` venue : sur un appareil qui sert aussi à une autre app
 * Supabase du parc, l'app s'ouvrait hors ligne sous un utilisateur qui n'est
 * pas le sien, et une vraie déconnexion passait pour un réseau muet.
 */

type Rappel = (event: string, session: unknown) => void;

const { rappels } = vi.hoisted(() => ({ rappels: [] as Rappel[] }));

/** La case où le SDK range la session de CE projet (`client.auth.storageKey`). */
const CASE = 'sb-projetuwh-auth-token';
/** Celle d'une autre app de la famille. */
const CASE_SOEUR = 'sb-uneautreapp-auth-token';

vi.mock('../backend/config.ts', () => ({
  BACKEND: 'supabase',
  IS_SUPABASE: true,
}));

vi.mock('../lib/supabase.ts', () => ({
  getSupabase: async () => ({
    auth: {
      storageKey: CASE,
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (rappel: Rappel) => {
        rappels.push(rappel);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
}));

const { AuthProvider } = await import('./AuthContext.tsx');
const { useAuth } = await import('./useAuth.ts');

function Sonde() {
  const { loading, session } = useAuth();
  if (loading) return <p>chargement</p>;
  return <p>{session ? `session ${session.user.id}` : 'sans-session'}</p>;
}

function monter() {
  render(
    <I18nProvider>
      <SocleLabels>
        <AuthProvider>
          <Sonde />
        </AuthProvider>
      </SocleLabels>
    </I18nProvider>
  );
}

/** La session telle que Supabase l'écrit, périmée depuis deux heures. */
function ranger(cle: string, uid: string) {
  localStorage.setItem(
    cle,
    JSON.stringify({
      access_token: 'entete.charge.signature',
      refresh_token: 'jeton-de-rafraichissement',
      expires_at: Math.floor(Date.now() / 1000) - 7200,
      user: { id: uid, email: `${uid}@exemple.fr` },
    })
  );
}

let onLineOriginal: PropertyDescriptor | undefined;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('uwh_locale', 'fr');
  rappels.length = 0;
  onLineOriginal ??= Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'onLine'
  );
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => false,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  if (onLineOriginal)
    Object.defineProperty(navigator, 'onLine', onLineOriginal);
});

describe('hors ligne, la session de ce projet', () => {
  it('ouvre sur la sienne, même rangée après celle d’une autre app', async () => {
    ranger(CASE_SOEUR, 'membre-soeur');
    ranger(CASE, 'membre-uwh');
    monter();

    await waitFor(() =>
      expect(screen.getByText('session membre-uwh')).toBeTruthy()
    );
  });

  it('la session d’une AUTRE app ne fait pas entrer', async () => {
    ranger(CASE_SOEUR, 'membre-soeur');
    monter();

    await waitFor(() => expect(screen.getByText('sans-session')).toBeTruthy());
  });

  it('une déconnexion VRAIE ferme la porte même si une autre app a sa session', async () => {
    ranger(CASE_SOEUR, 'membre-soeur');
    ranger(CASE, 'membre-uwh');
    monter();
    await waitFor(() =>
      expect(screen.getByText('session membre-uwh')).toBeTruthy()
    );

    // Supabase efface la session de CE projet, PUIS émet `SIGNED_OUT`.
    localStorage.removeItem(CASE);
    act(() => {
      for (const rappel of rappels) rappel('SIGNED_OUT', null);
    });

    await waitFor(() => expect(screen.getByText('sans-session')).toBeTruthy());
  });
});
