import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/index.ts';
import { LoginPage } from './LoginPage.tsx';

vi.mock('./useAuth.ts', () => ({
  useAuth: () => ({ signIn: vi.fn(), signInWithLink: vi.fn() }),
}));

/**
 * L'ÉCRAN DE CONNEXION DIT CE QU'EST L'APP.
 *
 * C'est le premier écran de tout visiteur, et le seul que voit un moteur.
 * Relevé du 23/09/2026 : son h1 était « Connexion ». Le nom de l'app est
 * désormais le titre de la page, suivi de ce qu'on y fait ; le formulaire garde
 * son titre, un cran plus bas.
 */
afterEach(cleanup);

describe('LoginPage', () => {
  it('a pour h1 le nom de l’app, suivi de ce qu’on y fait', () => {
    render(
      <I18nProvider>
        <LoginPage />
      </I18nProvider>
    );
    const titres = screen.getAllByRole('heading', { level: 1 });
    expect(titres).toHaveLength(1);
    expect(titres[0]).toHaveTextContent('Miss UWH');
    // jsdom annonce `en-US` : la phrase sort dans la langue du navigateur.
    expect(screen.getByText(/hockey/i)).toBeInTheDocument();
    // Le formulaire garde son titre, en h2.
    expect(
      screen.getByRole('heading', { level: 2, name: /connexion|sign in/i })
    ).toBeInTheDocument();
  });
});
