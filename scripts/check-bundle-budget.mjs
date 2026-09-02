/**
 * Garde-fou de taille du bundle. Lancé en fin de `npm run build` (donc aussi
 * dans le CI), il additionne le poids **gzip** de tout le JS émis et échoue si le
 * total dépasse le budget. Objectif : rendre visible et délibérée toute hausse
 * du code envoyé à l'utilisateur (une régression de bundle ne passe plus
 * inaperçue dans une PR).
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
// Budget TOTAL gzip du JS (kB). À ajuster sciemment : +budget = +code livré.
// Référence ~208 kB (juin 2026) ; ~10 % de marge pour les évolutions normales.
// +15 kB (i18n FR+EN) ; +5 kB (août 2026) : modules socle supabase-client +
// sync-queue (~4 kB réels — le SDK importé dynamiquement se tree-shake moins,
// mais le chunk `supabase` de ~51 kB quitte le chemin critique : chargé au
// premier `getClient()`, jamais en mode local).
//
// +5 kB (août 2026) : bascule de l'export Excel sur le module `xlsx` du socle.
// Coût MESURÉ +1,7 kB (248,7 → 250,4 kB : le chunk `vendor` passe de 16,1 à
// 17,9 kB, `SettingsScreen` maigrit de 0,1 kB — la glue SheetJS de l'export
// disparaît). Ce que ces 1,7 kB achètent : l'export ne charge plus SheetJS
// depuis un CDN tiers à l'exécution ; le trésorier qui clique « Classeur
// Excel » n'a plus besoin ni du réseau ni de cdn.sheetjs.com. Les 3,3 kB
// restants rendent au garde-fou une marge de travail : à 248,7 sur 250 il ne
// lui restait plus 1,3 kB, moins que le bruit d'une montée de dépendance — un
// budget qui échoue sur le bruit ne signale plus les régressions.
// 02/09/2026 : 255,0 kB mesurés, budget à 255 — les imports du socle
// (getDefaultLocale, createLogger) de la campagne PARC.md pèsent ~0,1 kB.
const TOTAL_GZIP_BUDGET_KB = 258;

const gzipKB = buf => gzipSync(buf).length / 1024;

let files;
try {
  files = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
} catch {
  console.error(
    `[budget] « ${ASSETS_DIR} » introuvable — lancez le build avant.`
  );
  process.exit(1);
}

const rows = files
  .map(f => ({ f, kb: gzipKB(readFileSync(join(ASSETS_DIR, f))) }))
  .sort((a, b) => b.kb - a.kb);
const total = rows.reduce((sum, r) => sum + r.kb, 0);

console.log('Bundle JS (gzip) :');
for (const r of rows)
  console.log(`  ${r.kb.toFixed(1).padStart(7)} kB  ${r.f}`);
console.log(`  ${'─'.repeat(10)}`);
console.log(`  ${total.toFixed(1).padStart(7)} kB  TOTAL`);

if (total > TOTAL_GZIP_BUDGET_KB) {
  console.error(
    `\n[budget] ❌ ${total.toFixed(1)} kB > budget ${TOTAL_GZIP_BUDGET_KB} kB.`
  );
  process.exit(1);
}
console.log(`\n[budget] ✅ sous le budget (${TOTAL_GZIP_BUDGET_KB} kB).`);
