import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
  pwaRegisterAlias,
} from '@mister-guiiug/dev-pwa-config/vitest-base';

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
      // Mesure du 13/09/2026, `syncQueue.ts` désormais couvert à 100 % :
      // 94,98 / 82,96 / 97,80 / 96,93. Les planchers sont posés DEUX POINTS
      // en dessous, et pas à la mesure exacte.
      //
      // C'est délibéré. `mister-footcoach` cale les siens au centième près, et
      // sa CI est passée au rouge sans qu'une ligne bouge : Vite 8.3 embarque
      // un Rolldown qui conserve davantage de commentaires à travers la
      // transformation JSX, donc davantage de `/* istanbul ignore next */`
      // survivent, donc des sous-arbres ENTIÈREMENT couverts sortent du
      // rapport et le ratio baisse. Le même dépôt mesure jusqu'à 0,39 point
      // d'écart entre un poste et le runner, avec des dénominateurs
      // différents — ce n'est donc pas un arrondi.
      //
      // Deux points absorbent ce bruit d'outillage sans rien laisser passer
      // d'une vraie régression. À monter quand la mesure monte, jamais à
      // baisser pour faire passer le rouge au vert.
      thresholds: {
        statements: 93,
        branches: 80,
        functions: 95,
        lines: 95,
      },
    },
  },
});
