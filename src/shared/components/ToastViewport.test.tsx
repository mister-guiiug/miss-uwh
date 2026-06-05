import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastViewport } from './ToastViewport.tsx';
import { notifyError, useToasts } from '../lib/toasts.ts';

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
