import { beforeEach, describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastViewport } from './ToastViewport.tsx';
import { notifyError, notifySuccess, useToasts } from '../lib/toasts.ts';
import { SocleLabels } from '../../i18n/SocleLabels.tsx';
import { I18nProvider } from '../../i18n/index.ts';

// Les libellés de la zone d'affichage viennent du socle (`SocleLabels`), qui
// suit la langue de l'app : on force FR pour assurer les textes attendus.
const render = (ui: Parameters<typeof rtlRender>[0]) => {
  localStorage.setItem('uwh_locale', 'fr');
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <I18nProvider>
        <SocleLabels>{children}</SocleLabels>
      </I18nProvider>
    ),
  });
};

describe('ToastViewport', () => {
  beforeEach(() => useToasts.getState().clear());

  it('monte ses régions vivantes AVANT tout message', () => {
    render(<ToastViewport />);

    // Un lecteur d'écran n'annonce une insertion que dans une région déjà
    // présente : les deux zones existent donc en permanence, vides et muettes.
    expect(
      screen.getByRole('region', { name: 'Notifications' })
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement(); // assertive
    expect(screen.getByRole('status')).toBeEmptyDOMElement(); // polie
  });

  it('annonce une erreur dans la région assertive', () => {
    notifyError('Sauvegarde impossible');
    render(<ToastViewport />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sauvegarde impossible'
    );
    // …et pas dans la polie : les deux files ne se mélangent pas.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('annonce un succès dans la région polie', () => {
    notifySuccess('Écriture enregistrée');
    render(<ToastViewport />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Écriture enregistrée'
    );
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
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
