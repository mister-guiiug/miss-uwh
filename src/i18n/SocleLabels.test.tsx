import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { I18nProvider } from './index.ts';
import { SocleLabels } from './SocleLabels.tsx';

/**
 * Les composants du socle portent leurs propres libellés et retombent sur le
 * FRANÇAIS hors provider. Ce test vérifie le seul raccordement que l'app
 * ajoute : que la croix d'une feuille suive bien la langue choisie — la
 * régression que la migration pouvait introduire sans qu'aucun type ne bronche.
 */
function renderSheet(locale: 'fr' | 'en') {
  localStorage.setItem('uwh_locale', locale);
  return render(
    <I18nProvider>
      <SocleLabels>
        <Sheet open title="Feuille" onClose={() => {}}>
          <p>corps</p>
        </Sheet>
      </SocleLabels>
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('SocleLabels', () => {
  it('étiquette la fermeture en français', () => {
    renderSheet('fr');
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('étiquette la fermeture en anglais', () => {
    renderSheet('en');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
