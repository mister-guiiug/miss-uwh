import { expect, test } from '@playwright/test';
import { unfoldLines } from '@mister-guiiug/dev-pwa-config/ical';

/**
 * Les rappels d'échéances, du registre des membres jusqu'au fichier `.ics`,
 * sur le build de production.
 *
 * CE QUE CE PARCOURS TIENT, ET QU'AUCUN TEST UNITAIRE NE TIENT : que le
 * bouton de l'écran des membres produise réellement un téléchargement — le
 * module d'export est chargé à la demande, par un `import()` que seul un vrai
 * build découpe —, et que le fichier reçu porte les deux rappels `VALARM`.
 * Le contenu détaillé est tenu par `deadlinesIcs.test.ts`.
 */
test('@critical les échéances des membres partent dans un agenda, avec leurs deux rappels', async ({
  page,
}) => {
  await page.goto('/miss-uwh/');
  await page.getByLabel('Nom du club').fill('Club E2E');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();

  await page.goto('/miss-uwh/#/adherents');
  await page.getByRole('button', { name: 'Membre', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Nouveau membre' });
  await sheet.getByLabel('Prénom').fill('Léa');
  await sheet.getByLabel('Nom', { exact: true }).fill('Martin');
  // Loin devant : le parcours ne dépend pas de la date du jour.
  await sheet.getByLabel('Licence — expire le').fill('2099-10-31');
  await sheet.getByRole('button', { name: 'Ajouter' }).click();
  await expect(sheet).toBeHidden();

  await page
    .getByRole('button', {
      name: 'Exporter les rappels d’échéances vers un agenda',
    })
    .click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('1 échéance(s) à venir');
  await expect(dialog).toContainText('Google Agenda les ignore');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Télécharger (.ics)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^club-e2e-.*-echeances\.ics$/);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  // Déplié comme le lirait un client d'agenda : avec un vrai UUID, la ligne
  // `UID` dépasse 75 octets et le socle la PLIE (RFC 5545 §3.1).
  const lines = unfoldLines(Buffer.concat(chunks).toString('utf8'));

  expect(lines[0]).toBe('BEGIN:VCALENDAR');
  expect(lines).toContain('DTSTART;VALUE=DATE:20991031');
  expect(
    lines.filter(line =>
      /^UID:echeance-[0-9a-f-]+-licence-2099-10-31@miss-uwh$/.test(line)
    )
  ).toHaveLength(1);
  // Un mois avant à 9 h, puis la veille à 9 h.
  expect(lines).toContain('TRIGGER:-P29DT15H');
  expect(lines).toContain('TRIGGER:-PT15H');
  expect(lines.filter(line => line === 'BEGIN:VALARM')).toHaveLength(2);
});
