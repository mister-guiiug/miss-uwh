import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.tsx';

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
