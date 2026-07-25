import { afterEach, describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { I18nProvider } from '../../i18n/index.ts';

// L'écran de secours consomme useI18n : on enveloppe chaque rendu dans le
// provider i18n (sinon useI18n lève « doit être utilisé dans son I18nProvider »).
const render = (ui: Parameters<typeof rtlRender>[0]) => {
  // jsdom rapporte navigator.language=en-US : on force FR pour que les
  // assertions sur le texte français restent valides.
  localStorage.setItem('uwh_locale', 'fr');
  return rtlRender(ui, { wrapper: I18nProvider });
};

function Boom(): never {
  throw new Error('rendu cassé');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rend les enfants quand tout va bien', () => {
    render(
      <ErrorBoundary>
        <p>contenu sain</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('contenu sain')).toBeInTheDocument();
  });

  it('affiche l’écran de secours « app » + bouton d’export sur erreur', () => {
    // React journalise l'erreur capturée : on la fait taire pour ne pas polluer.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary level="app">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/erreur inattendue/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /télécharger mes données/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /recharger l/i })
    ).toBeInTheDocument();
    // Le message technique est exposé dans le repli.
    expect(screen.getByText('rendu cassé')).toBeInTheDocument();
  });

  it('niveau « route » : encart compact avec Réessayer + Accueil', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary level="route">
        <Boom />
      </ErrorBoundary>
    );
    expect(
      screen.getByText(/cet écran a rencontré un problème/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /réessayer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /accueil/i })
    ).toBeInTheDocument();
  });
});
