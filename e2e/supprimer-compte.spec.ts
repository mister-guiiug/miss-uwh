import { expect, test } from '@playwright/test';

/**
 * EN MODE LOCAL, IL N'Y A PAS DE COMPTE — donc pas de bouton pour le
 * supprimer.
 *
 * CE QUE CE PARCOURS TIENT, ET QU'AUCUN TEST UNITAIRE NE TIENT ICI : la garde
 * `IS_SUPABASE` de `SettingsScreen`. C'est une condition d'une ligne, lue à
 * l'IMPORT depuis `import.meta.env` — donc invisible pour un test de
 * composant, qui monte la carte directement. Elle ne s'éprouve que sur un
 * bundle réellement construit, ce que fait ce parcours (`vite build --mode
 * e2e`, sans configuration Supabase).
 *
 * L'ENJEU. Sans elle, un club qui utilise l'app seule, hors ligne et sans
 * serveur — le cas nominal sur GitHub Pages — se verrait proposer de supprimer
 * un compte qui n'existe pas : le bouton échouerait, ou pire, laisserait
 * croire que quelque chose a été effacé quelque part.
 *
 * Le vrai parcours de suppression exige une session Supabase, que la CI n'a
 * pas. Ce qu'il ferait est tenu ailleurs : la fonction serveur par les
 * assertions pgTAP (`supabase/tests/suppression-compte.test.sql`), l'écran par
 * `DeleteAccountCard.test.tsx`.
 */
test('@critical en mode local, la zone sensible n’offre pas de suppression de compte', async ({
  page,
}) => {
  await page.goto('/miss-uwh/');

  await page.getByLabel('Nom du club').fill('Club E2E');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();

  await page.goto('/miss-uwh/#/settings');

  // La zone sensible est repliée : c'est son bouton qui la déplie.
  await page.getByRole('button', { name: 'Zone sensible' }).click();

  // Le voisin immédiat, lui, est bien là — sans quoi ce test serait vert sur
  // une page qui n'a simplement pas fini de se monter.
  await expect(
    page.getByRole('button', { name: 'Tout réinitialiser' })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Supprimer mon compte' })
  ).toHaveCount(0);
});
