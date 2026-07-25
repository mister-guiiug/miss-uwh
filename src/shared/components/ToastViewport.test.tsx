import { beforeEach, describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastViewport } from './ToastViewport.tsx';
import { notifyError, useToasts } from '../lib/toasts.ts';
import { I18nProvider } from '../../i18n/index.ts';

// ToastViewport consomme useI18n : chaque rendu doit être enveloppé dans le
// provider i18n (sinon useI18n lève « doit être utilisé dans son I18nProvider »).
const render = (ui: Parameters<typeof rtlRender>[0]) => {
  // jsdom rapporte navigator.language=en-US : on force FR pour que les
  // assertions sur le texte français restent valides.
  localStorage.setItem('uwh_locale', 'fr');
  return rtlRender(ui, { wrapper: I18nProvider });
};

describe('ToastViewport', () => {
  beforeEach(() => useToasts.getState().clear());

  it('ne rend rien sans toast', () => {
    const { container } = render(<ToastViewport />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche un toast d’erreur en role="alert"', () => {
    notifyError('Sauvegarde impossible');
    render(<ToastViewport />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Sauvegarde impossible');
  });

  it('le bouton Fermer retire le toast', async () => {
    const user = userEvent.setup();
    notifyError('à fermer');
    render(<ToastViewport />);
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(screen.queryByText('à fermer')).not.toBeInTheDocument();
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});
