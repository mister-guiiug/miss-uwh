import { expect, test, type Route } from '@playwright/test';

/**
 * « Lire le justificatif », DANS UN VRAI NAVIGATEUR, sur le build de
 * production.
 *
 * CE QUE CE PARCOURS TIENT, ET QU'AUCUN TEST UNITAIRE NE PEUT TENIR :
 *  - la CSP du build laisse partir l'appel au fournisseur d'IA. Elle le
 *    bloquait : `connect-src` ne nommait que Supabase, et la génération
 *    d'exercices échouait en production depuis la pose de la CSP. Un appel
 *    bloqué par la CSP n'atteint jamais le réseau — donc jamais la route
 *    ci-dessous : ce test tomberait ;
 *  - le vrai canvas de Chromium réduit et ré-encode la photo (jsdom n'en a
 *    pas) : c'est un JPEG qui part, en base64, dans un bloc `image` ;
 *  - la lecture PRÉ-REMPLIT le formulaire, et rien n'est enregistré.
 *
 * Le fournisseur est SIMULÉ par `page.route` : aucune requête ne quitte la
 * machine, aucune clé réelle n'est utilisée.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';

/** Répond à l'appel du navigateur — préflight CORS compris. */
async function fakeAnthropic(
  route: Route,
  sent: { headers?: Record<string, string>; body?: unknown }
) {
  const request = route.request();
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers':
      request.headers()['access-control-request-headers'] ?? '*',
  };
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: cors });
    return;
  }
  sent.headers = request.headers();
  sent.body = request.postDataJSON();
  await route.fulfill({
    status: 200,
    headers: cors,
    contentType: 'application/json',
    body: JSON.stringify({
      content: [
        {
          type: 'text',
          text: '```json\n{"date":"04/10/2025","amount":"42,50 €","label":"Piscine municipale","sens":"debit","categoryCode":"D9","confidence":0.93}\n```',
        },
      ],
    }),
  });
}

test('@critical un justificatif lu par l’IA pré-remplit l’écriture, sans l’enregistrer', async ({
  page,
}) => {
  const sent: { headers?: Record<string, string>; body?: unknown } = {};
  await page.route(ANTHROPIC, route => fakeAnthropic(route, sent));

  await page.goto('/miss-uwh/');
  await page.getByLabel('Nom du club').fill('Club E2E');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();

  // La clé de l'utilisateur, sur cet appareil (fournisseur par défaut : Claude).
  await page.goto('/miss-uwh/#/settings');
  await page.getByLabel('Clé API (cet appareil)').fill('sk-ant-e2e');

  await page.goto('/miss-uwh/#/finances/journal');
  // Le premier lancement charge le jeu de démonstration : on compte.
  const count = page.getByText(/^\d+ écriture\(s\)$/);
  const before = await count.textContent();
  await page.getByRole('button', { name: 'Écriture', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Nouvelle écriture' });

  // Une « photo » dessinée par le navigateur lui-même : un vrai PNG.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 480;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 320, 480);
    g.fillStyle = '#000';
    g.font = '20px sans-serif';
    g.fillText('PISCINE MUNICIPALE', 20, 60);
    g.fillText('TOTAL TTC 42,50 EUR', 20, 420);
    return canvas.toDataURL('image/png');
  });
  await sheet
    .locator('input[type="file"][accept="image/*,application/pdf"]')
    .setInputFiles({
      name: 'ticket.png',
      mimeType: 'image/png',
      buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
    });

  // Au premier envoi, l'app dit où part le justificatif.
  const notice = page.getByRole('alertdialog');
  await expect(notice).toContainText('api.anthropic.com');
  await notice.getByRole('button', { name: 'Envoyer' }).click();

  await expect(sheet.getByRole('status')).toContainText('confiance 93 %');
  await expect(sheet.getByLabel('Libellé')).toHaveValue('Piscine municipale');
  await expect(sheet.getByLabel('Montant (€)')).toHaveValue('42.5');
  await expect(sheet.getByLabel('Date', { exact: true })).toHaveValue(
    '2025-10-04'
  );
  await expect(sheet.getByLabel('Catégorie')).toHaveValue('D9');

  // Ce qui est parti : la clé de l'utilisateur, et un JPEG ré-encodé.
  expect(sent.headers?.['x-api-key']).toBe('sk-ant-e2e');
  expect(sent.headers?.['anthropic-dangerous-direct-browser-access']).toBe(
    'true'
  );
  const content = (
    sent.body as {
      messages: Array<{
        content: Array<{ type: string; source?: { media_type: string } }>;
      }>;
    }
  ).messages[0]!.content;
  expect(content[0]).toMatchObject({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg' },
  });

  // Jamais d'enregistrement automatique : on ferme sans valider.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(count).toHaveText(before ?? '');
  await expect(page.getByText('Piscine municipale')).toHaveCount(0);
});
