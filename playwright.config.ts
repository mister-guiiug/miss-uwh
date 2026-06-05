import { defineConfig, devices } from '@playwright/test';

/**
 * Config e2e. La PWA est servie en build de production (base `/miss-uwh/`) par
 * `vite preview`. Le workflow CI famille lance :
 *   npx playwright install chromium --with-deps
 *   npx playwright test --grep "@critical" --project=chromium
 * (cf. ci.yml : run-e2e). Les specs vivent dans `e2e/` (exclu de Vitest/tsc).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Build en mode local (sans Supabase → parcours onboarding) puis preview.
    command:
      'npx vite build --mode e2e && npx vite preview --base /miss-uwh/ --port 4173 --strictPort',
    url: 'http://localhost:4173/miss-uwh/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
