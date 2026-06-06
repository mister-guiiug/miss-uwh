import { test, expect } from '@playwright/test';

/**
 * Parcours critique (mode local, sans serveur) : première ouverture →
 * onboarding → lanceur d'accueil avec ses espaces et la synthèse de saison.
 * Tagué `@critical` : c'est le filtre `--grep` utilisé par le CI.
 */
test('@critical onboarding mène au lanceur avec les espaces', async ({
  page,
}) => {
  await page.goto('/miss-uwh/');

  // Écran d'onboarding.
  await expect(page.getByRole('heading', { name: 'Miss UWH' })).toBeVisible();
  await page.getByLabel('Nom du club').fill('Club E2E');
  await page.getByRole('button', { name: 'Commencer' }).click();

  // Lanceur d'accueil : une carte par espace + la carte « Saison … ».
  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();
  await expect(page.getByText(/Saison/).first()).toBeVisible();
});

test('@critical ouverture de l’espace Finances depuis le lanceur', async ({
  page,
}) => {
  await page.goto('/miss-uwh/');
  await page.getByLabel('Nom du club').fill('Club E2E');
  await page.getByRole('button', { name: 'Commencer' }).click();

  // Attendre que le lanceur soit monté (évite un clic pendant la transition
  // onboarding → routeur, source de flakiness en exécution parallèle).
  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();

  // Le lanceur expose les espaces sous forme de liens ; on ouvre Finances.
  await page.getByRole('link', { name: /Finances/ }).click();
  await expect(page).toHaveURL(/#\/finances$/);
  // La barre de navigation du lens Finances est montée (onglet « Journal »).
  // `exact` : sinon « Journal » matche aussi « Voir le journal » et « Journal
  // d'audit » → violation du mode strict de Playwright.
  await expect(
    page.getByRole('link', { name: 'Journal', exact: true })
  ).toBeVisible();
});
