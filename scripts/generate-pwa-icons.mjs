#!/usr/bin/env node
/**
 * Génère les icônes PWA (PNG) à partir de `public/icons/icon.svg` via sharp.
 * Produit : icon-192, icon-512, icon-512-maskable (dessiné à part, à fond
 * perdu — voir `renderMaskable`),
 * apple-touch-icon (fond plein, sans transparence).
 *
 * Usage : npm run icons
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');
const svg = readFileSync(join(iconsDir, 'icon.svg'));

const BG = '#1758ba';

async function render(size, file, { opaque = false } = {}) {
  const buffer = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: opaque ? BG : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: buffer, top: 0, left: 0 }]);

  const out = await canvas.png().toBuffer();
  writeFileSync(join(iconsDir, file), out);
  console.log(`✓ ${file} (${size}×${size})`);
}

/**
 * LE MASKABLE EST UNE AUTRE IMAGE, PAS L'ICÔNE EN PLUS PETIT.
 *
 * Cette fonction le fabriquait en réduisant l'icône ENTIÈRE à 80 % sur un aplat
 * `#1758ba`. La tuile arrondie se retrouvait posée au milieu d'un bleu plus
 * sombre, et le raccord se voyait — mesuré, le coin rendait rgb(23,88,186)
 * quand l'intérieur rendait rgb(55,119,213). Android ne cache pas ce bord, il
 * le révèle, et aucun choix d'aplat ne le supprime.
 *
 * `icon-maskable.svg` reprend le même dégradé et le même dessin, sans les coins
 * arrondis et avec le sujet ramené dans le disque de sécurité. Le commentaire
 * du SVG dit ce qui en diffère.
 */
async function renderMaskable() {
  const source = readFileSync(join(iconsDir, 'icon-maskable.svg'));
  const out = await sharp(source, { density: 384 })
    .resize(512, 512)
    .png()
    .toBuffer();
  writeFileSync(join(iconsDir, 'icon-512-maskable.png'), out);
  console.log('✓ icon-512-maskable.png (512×512, à fond perdu)');
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await renderMaskable();
await render(180, 'apple-touch-icon.png', { opaque: true });

console.log('Icônes PWA générées.');
