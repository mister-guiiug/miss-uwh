import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { I18nProvider } from '../i18n/index.ts';
import { SocleLabels } from '../i18n/SocleLabels.tsx';
import { useToasts } from '../shared/lib/toasts.ts';
import { getSyncQueue } from '../backend/syncQueue.ts';

/**
 * LA DÉCONNEXION JETTE LA FILE — JAMAIS EN SILENCE.
 *
 * La purge est voulue : l'appareil peut être celui du club, et une écriture
 * laissée par le membre qui part repartirait sous la session du suivant, à son
 * nom et sous ses droits. Mais ces écritures, la personne les croit
 * enregistrées. Avant, le bouton « Se déconnecter » les jetait sans un mot.
 *
 *  - déconnexion DEMANDÉE : on compte, et on demande (le geste de mister-doc) ;
 *  - déconnexion SUBIE (jeton révoqué, session fermée ailleurs) : personne à
 *    qui demander. La purge a lieu, et on dit combien d'écritures sont parties
 *    avec elle.
 */

type Rappel = (event: string, session: unknown) => void;

const { rappels, signOut } = vi.hoisted(() => ({
  rappels: [] as Rappel[],
  signOut: vi.fn(),
}));

vi.mock('../backend/config.ts', () => ({
  BACKEND: 'supabase',
  IS_SUPABASE: true,
}));

vi.mock('../lib/supabase.ts', () => ({
  getSupabase: async () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (rappel: Rappel) => {
        rappels.push(rappel);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut,
    },
  }),
}));

const { AuthProvider } = await import('./AuthContext.tsx');
const { useAuth } = await import('./useAuth.ts');

function Sonde() {
  const { loading, signOut: seDeconnecter } = useAuth();
  if (loading) return <p>chargement</p>;
  return (
    <button type="button" onClick={() => void seDeconnecter()}>
      Sortir
    </button>
  );
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

/** Ce que fait Supabase : la session est effacée, PUIS `SIGNED_OUT` part. */
function deconnexionSupabase() {
  act(() => {
    for (const rappel of rappels) rappel('SIGNED_OUT', null);
  });
}

const enAttente = () =>
  getSyncQueue().pending() + getSyncQueue().deadLetters().length;
const messages = () => useToasts.getState().toasts.map(t => t.message);
const boite = () => screen.queryByRole('alertdialog');
const confirmer = () =>
  document.querySelector<HTMLButtonElement>('[data-dwc="confirm-confirm"]')!;
const annuler = () =>
  document.querySelector<HTMLButtonElement>('[data-dwc="confirm-cancel"]')!;

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  rappels.length = 0;
  signOut.mockReset();
  signOut.mockImplementation(async () => {
    deconnexionSupabase();
    return { error: null };
  });
  getSyncQueue().clear();
  useToasts.getState().clear();
});

afterEach(() => {
  cleanup();
  getSyncQueue().stop();
  getSyncQueue().clear();
});

describe('déconnexion demandée', () => {
  it('file vide : se déconnecte sans rien demander', async () => {
    monter();
    fireEvent.click(await screen.findByRole('button', { name: 'Sortir' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(boite()).toBeNull();
  });

  it('des écritures en attente : compte, demande, et ne part pas sans accord', async () => {
    getSyncQueue().enqueue({ kind: 'event.delete', id: 'ev1' });
    getSyncQueue().enqueue({ kind: 'event.delete', id: 'ev2' });
    monter();

    fireEvent.click(await screen.findByRole('button', { name: 'Sortir' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      /2 modification\(s\)/
    );
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(annuler());

    await waitFor(() => expect(boite()).toBeNull());
    expect(signOut).not.toHaveBeenCalled();
    expect(enAttente()).toBe(2);
  });

  it('accord donné : la file est vidée, la session fermée, sans second message', async () => {
    getSyncQueue().enqueue({ kind: 'event.delete', id: 'ev1' });
    monter();

    fireEvent.click(await screen.findByRole('button', { name: 'Sortir' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(confirmer());

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(enAttente()).toBe(0);
    // La personne vient de dire « les perdre » : le lui répéter serait du bruit.
    expect(messages()).toEqual([]);
  });
});

describe('déconnexion subie', () => {
  it('purge quand même, et dit combien d’écritures sont parties avec elle', async () => {
    getSyncQueue().enqueue({ kind: 'event.delete', id: 'ev1' });
    getSyncQueue().enqueue({ kind: 'event.delete', id: 'ev2' });
    getSyncQueue().enqueue({ kind: 'event.delete', id: 'ev3' });
    monter();
    await screen.findByRole('button', { name: 'Sortir' });

    deconnexionSupabase();

    expect(enAttente()).toBe(0);
    expect(messages()).toEqual([
      expect.stringMatching(/3 modification\(s\) non envoyée\(s\)/),
    ]);
  });

  it('rien en attente : rien à dire', async () => {
    monter();
    await screen.findByRole('button', { name: 'Sortir' });

    deconnexionSupabase();

    expect(messages()).toEqual([]);
  });
});
