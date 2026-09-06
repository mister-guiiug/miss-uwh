import { expect, test } from '@playwright/test';

/**
 * Le bilan de l'AG en FICHIER.
 *
 * CE QUE CE PARCOURS TIENT, ET QU'AUCUN TEST UNITAIRE NE PEUT TENIR : que le
 * bouton de l'écran Bilan produise réellement un téléchargement dans un vrai
 * navigateur. Les tests unitaires prouvent le CONTENU du PDF ; ici on prouve
 * qu'il SORT — `window.print()` n'a jamais rien téléchargé, et c'est
 * exactement le trou que ce chantier bouche.
 *
 * Chromium de bureau n'expose pas `navigator.canShare` pour les fichiers : le
 * chemin exercé est donc le REPLI (téléchargement), c'est-à-dire celui que
 * prendra tout ordinateur du bureau du club. Le chemin « partage natif » est
 * couvert par les tests unitaires, `navigator.share` étant instrumenté.
 */
test('@critical le bilan se télécharge en PDF depuis l’écran Bilan', async ({
  page,
}) => {
  await page.goto('/miss-uwh/');

  // Onboarding : nommer le club (il figurera en tête du PDF).
  await page.getByLabel('Nom du club').fill('Club E2E');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();

  // L'écran Bilan est la page d'accueil de l'espace Finances.
  await page.getByRole('link', { name: /Finances/ }).click();
  await expect(page).toHaveURL(/#\/finances$/);

  const share = page.getByRole('button', { name: 'Partager le bilan en PDF' });
  await expect(share).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    share.click(),
  ]).then(([d]) => d);

  expect(download.suggestedFilename()).toMatch(/^bilan-.*\.pdf$/);

  // Le fichier reçu EST un PDF, pas une page d'erreur renommée.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  expect(bytes.toString('latin1')).toContain('Club E2E');
});
