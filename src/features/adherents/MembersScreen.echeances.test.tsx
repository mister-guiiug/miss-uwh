import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/index.ts';
import { SocleLabels } from '../../i18n/SocleLabels.tsx';
import { useAppStore } from '../../store/useAppStore.ts';
import { useToasts } from '../../shared/lib/toasts.ts';
import type { Deadline } from '../../shared/lib/expiry.ts';

/**
 * L'export des rappels d'échéances, vu de l'écran des membres. Ce que le
 * fichier contient est tenu par `deadlinesIcs.test.ts` ; ici :
 *  - le geste est là où les échéances se consultent — pas sur l'onglet
 *    Encadrement, filtré, qui n'en porte qu'une partie ;
 *  - AVANT de télécharger, la boîte dit ce que les agendas feront des
 *    rappels : Google Agenda les ignore, Apple Calendar et Outlook les
 *    honorent ;
 *  - sans échéance à venir, elle le dit, et rien ne se télécharge.
 */

const downloadDeadlinesIcs = vi.fn<(deadlines: Deadline[]) => void>();
vi.mock('../export/deadlinesIcs.ts', () => ({
  downloadDeadlinesIcs: (deadlines: Deadline[]) =>
    downloadDeadlinesIcs(deadlines),
}));

const { MembersScreen } = await import('./MembersScreen.tsx');

const get = () => useAppStore.getState();

function mount(roleFilter?: 'encadrant') {
  render(
    <MemoryRouter>
      <I18nProvider>
        <SocleLabels>
          <MembersScreen roleFilter={roleFilter} />
        </SocleLabels>
      </I18nProvider>
    </MemoryRouter>
  );
}

const exportButton = () =>
  screen.getByRole('button', {
    name: 'Exporter les rappels d’échéances vers un agenda',
  });

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  get().resetAll('Club test', '2025-2026', 0);
  downloadDeadlinesIcs.mockReset();
  useToasts.getState().clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Membres — rappels d’échéances', () => {
  it('la boîte compte les échéances à venir et dit ce qu’en font les agendas, puis télécharge', async () => {
    const seasonId = get().data.activeSeasonId;
    get().addAdherent({
      seasonId,
      firstName: 'Léa',
      lastName: 'Martin',
      category: 'adulte',
      amount: 0,
      paid: true,
      // Loin devant : le test ne dépend pas de la date du jour.
      licenceExpiry: '2099-10-31',
      medicalCertExpiry: '2099-11-15',
    });
    mount();

    fireEvent.click(exportButton());

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('2 échéance(s) à venir');
    expect(dialog.textContent).toContain('un mois avant à 9 h');
    expect(dialog.textContent).toContain('la veille à 9 h');
    expect(dialog.textContent).toContain('Google Agenda les ignore à l’import');
    expect(dialog.textContent).toContain(
      'Apple Calendar et Outlook honorent ces rappels'
    );
    expect(dialog.textContent).toContain('Les assurances n’ont pas de date');

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger (.ics)' }));

    await waitFor(() => expect(downloadDeadlinesIcs).toHaveBeenCalledTimes(1));
    expect(
      downloadDeadlinesIcs.mock.calls[0]![0].map(d => `${d.kind} ${d.date}`)
    ).toEqual(['licence 2099-10-31', 'medicalCert 2099-11-15']);
    await waitFor(() =>
      expect(useToasts.getState().toasts.map(t => t.message)).toContain(
        '2 échéance(s) exportée(s) pour votre agenda.'
      )
    );
  });

  it('sans échéance à venir, la boîte le dit et rien ne se télécharge', async () => {
    mount();

    fireEvent.click(exportButton());

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Aucune échéance à venir');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(downloadDeadlinesIcs).not.toHaveBeenCalled();
  });

  it('pas de geste sur l’onglet Encadrement, qui ne porte qu’une partie des adhérents', () => {
    mount('encadrant');

    expect(
      screen.queryByRole('button', {
        name: 'Exporter les rappels d’échéances vers un agenda',
      })
    ).toBeNull();
  });
});
