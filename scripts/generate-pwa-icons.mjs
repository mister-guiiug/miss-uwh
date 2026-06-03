#!/usr/bin/env node
/**
 * Génère les icônes PWA (PNG) à partir de `public/icons/icon.svg` via sharp.
 * Produit : icon-192, icon-512, icon-512-maskable (padding de sécurité),
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

const BG = '#0f766e';

async function render(size, file, { maskable = false, opaque = false } = {}) {
  // Maskable : on réduit le glyphe pour respecter la "safe zone" (~80%).
  const inner = maskable ? Math.round(size * 0.8) : size;
  const pad = Math.round((size - inner) / 2);

  const buffer = await sharp(svg, { density: 384 })
    .resize(inner, inner)
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: opaque || maskable ? BG : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: buffer, top: pad, left: pad }]);

  const out = await canvas.png().toBuffer();
  writeFileSync(join(iconsDir, file), out);
  console.log(`✓ ${file} (${size}×${size})`);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-512-maskable.png', { maskable: true });
await render(180, 'apple-touch-icon.png', { opaque: true });

console.log('Icônes PWA générées.');
