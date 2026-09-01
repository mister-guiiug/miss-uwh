import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
  pwaRegisterAlias,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

// Planchers de couverture sur le cœur métier PUR (moteur comptable, mappers,
// rapprochement, file de sync, validation, export). À monter, jamais à baisser.
export default defineConfig({
  plugins: [react()],
  // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent d'ici :
  // sans ce double, tout test qui monte la bannière de mise à jour échoue à
  // l'import, avant d'avoir rien éprouvé. Le double du socle est PILOTABLE
  // (`swStub.needRefresh()`), là où la copie locale était muette.
  resolve: { alias: { ...pwaRegisterAlias } },
  test: {
    ...baseTestOptions,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      ...coveragePreset,
      provider: 'v8' as const,
      include: [
        'src/shared/lib/engine.ts',
        'src/features/reconcile/bankMatch.ts',
        'src/features/export/buildWorkbook.ts',
        'src/features/import/compteMapping.ts',
        'src/backend/syncQueue.ts',
        'src/features/journal/entryValidation.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 90,
        lines: 90,
      },
    },
  },
});
