import { test, expect } from '@playwright/test';
import { expectEcranEntreeCable } from '@mister-guiiug/dev-pwa-config/playwright-entree';

/*
 * L'ÉCRAN D'ENTRÉE, VÉRIFIÉ LÀ OÙ IL CASSE.
 *
 * Trois fois en un mois, une pièce à effet de bord s'est retrouvée montée
 * DERRIÈRE la porte de cette app — `registerSW` d'abord, le bandeau de
 * consentement ensuite, la vue de page enfin. À chaque fois le code était juste
 * et la CI verte : seul un chargement réel, en état « pas encore entré », le
 * voyait. Les trois ont été trouvées en production.
 *
 * Cette spec est la garde qui manquait. Elle ne teste pas un composant, elle
 * teste une PLACE.
 */
test.describe('@critical écran d’entrée', () => {
  test('la question est posée, une vue part, le service worker s’enregistre', async ({
    page,
  }) => {
    await expectEcranEntreeCable(page, expect, { url: '/miss-uwh/' });
  });
});
