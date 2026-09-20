import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lazy, type ComponentType } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './i18n/index.ts';
import { Shell } from './App.tsx';

/**
 * CE QUE CE TEST VERROUILLE : que le clic sur un onglet de la barre réponde.
 *
 * Il tient une propriété qui ne se lit nulle part dans le code, et qu'aucun
 * autre test ne protège. Onze dépôts du parc portent le couple `React.lazy` +
 * react-router 7 ; sur six d'entre eux, un clic de menu ne produit RIEN de
 * visible pendant tout l'aller-retour réseau du morceau — mesuré à froid le
 * 20/09/2026 sur deux sites publiés : 133 ms sur mister-settle, 161 ms sur
 * mister-molkky, écran précédent figé.
 *
 * La cause : react-router 7 enveloppe tout changement d'URL dans
 * `startTransition`, et React 19 garde alors délibérément l'écran déjà affiché
 * plutôt que de montrer le repli de `<Suspense>`. Le repli devient du code mort
 * au clic.
 *
 * MISS-UWH Y ÉCHAPPE, PAR ACCIDENT. `ErrorBoundary` porte `key={pathname}` —
 * posé pour qu'un crash d'écran n'emporte ni l'en-tête ni la navigation — donc
 * la frontière `Suspense` qu'elle contient est RE-MONTÉE à chaque navigation.
 * Le repli d'une frontière NEUVE paraît même au sein d'une transition : le
 * « Chargement… » répond donc au clic.
 *
 * Retirer ce `key` (un nettoyage plausible : « la frontière n'a pas besoin de
 * se remonter ») rendrait le clic muet sans casser aucun autre test. D'où
 * celui-ci.
 */

/** Monte la coquille face à un écran dont on décide nous-même de l'arrivée. */
function monterFaceAUnEcranLent() {
  let resous!: () => void;
  const EcranLent = lazy(
    () =>
      new Promise<{ default: ComponentType }>(resolve => {
        resous = () => resolve({ default: () => <h1>Le journal</h1> });
      })
  );

  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/finances']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="finances">
              <Route index element={<h1>Le bilan</h1>} />
              <Route path="journal" element={<EcranLent />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );

  return {
    // Une expression régulière, pas une chaîne : la barre ajoute « page
    // actuelle » au nom accessible de l'onglet courant.
    onglet: (nom: RegExp) => screen.getByRole('link', { name: nom }),
    livreLEcran: async () => {
      await act(async () => {
        resous();
      });
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  // Force la locale FR : jsdom rapporte `navigator.language = en-US`.
  localStorage.setItem('uwh_locale', 'fr');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('le clic sur un onglet de la barre répond', () => {
  it("montre le repli de route tant que l'écran n'est pas arrivé", async () => {
    const { onglet, livreLEcran } = monterFaceAUnEcranLent();

    expect(
      screen.getByRole('heading', { name: 'Le bilan' })
    ).toBeInTheDocument();

    fireEvent.click(onglet(/Journal/));

    // LE POINT DE TOUT LE TEST. L'écran précédent a cédé la place au repli du
    // `Suspense` — ce qui n'arrive QUE parce que la frontière est re-montée par
    // `key={pathname}`. Sans ce `key`, React garderait « Le bilan » à l'écran
    // pendant tout l'aller-retour, sans rien dire.
    expect(screen.queryByRole('heading', { name: 'Le bilan' })).toBeNull();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();

    await livreLEcran();

    expect(
      screen.getByRole('heading', { name: 'Le journal' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('garde la barre du lens sous les yeux pendant le chargement', () => {
    const { onglet } = monterFaceAUnEcranLent();

    fireEvent.click(onglet(/Journal/));

    // Ce qui dit « je charge » doit survivre au clic : la barre est hors de la
    // frontière re-montée, donc elle reste.
    expect(onglet(/Journal/)).toBeInTheDocument();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });
});
