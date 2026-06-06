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
const TOTAL_GZIP_BUDGET_KB = 230;

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
