// Suite a11y minimale (axe-core + Playwright) — template dev-pwa-config.
// Sert le build de prod sous /miss-uwh/ (cf. playwright.config.ts).
// Le tag @a11y permet de filtrer : `playwright test --grep @a11y`.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectNoA11yViolations } from '@mister-guiiug/dev-pwa-config/playwright-a11y';

test.describe('@a11y accessibilité', () => {
  test("écran d'accueil (onboarding) sans violation WCAG A/AA", async ({
    page,
  }) => {
    await page.goto('/miss-uwh/');
    await expectNoA11yViolations(page, AxeBuilder, expect);
  });
});
