import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync } from 'node:fs';

const analyze = process.env.ANALYZE === '1';
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

// Déployé sur GitHub Pages : https://mister-guiiug.github.io/miss-uwh/
export default defineConfig(({ command }) => {
  // Honore VITE_BASE_PATH (deploy → /miss-uwh/, Lighthouse CI → /) ; sinon
  // /miss-uwh/ au build, / en dev.
  const basePath =
    process.env.VITE_BASE_PATH ?? (command === 'build' ? '/miss-uwh/' : '/');

  return {
    base: basePath,
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const norm = id.replace(/\\/g, '/');
            if (norm.includes('/@supabase/')) return 'supabase';
            if (norm.includes('/lucide-react/')) return 'icons';
            if (
              norm.includes('/react-dom/') ||
              norm.includes('/node_modules/react/') ||
              norm.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            if (norm.includes('/react-router')) return 'router';
            if (norm.includes('/zustand/')) return 'zustand';
            if (norm.includes('/zod/')) return 'zod';
            return 'vendor';
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/apple-touch-icon.png',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4_000_000,
        },
        manifest: {
          id: '/miss-uwh/',
          name: 'Miss UWH — Bilan comptable',
          short_name: 'Miss UWH',
          description:
            'Bilan comptable saisonnier d’un club de Hockey Subaquatique : journal, recettes/dépenses par catégorie, clôture de saison, justificatifs.',
          theme_color: '#1758ba',
          background_color: '#f3f6fc',
          display: 'standalone',
          orientation: 'portrait',
          scope: basePath,
          start_url: basePath,
          lang: 'fr',
          dir: 'ltr',
          categories: ['finance', 'productivity', 'sports'],
          shortcuts: [
            {
              name: 'Bilan',
              short_name: 'Bilan',
              url: `${basePath}#/finances`,
            },
            {
              name: 'Journal',
              short_name: 'Journal',
              url: `${basePath}#/finances/journal`,
            },
            {
              name: 'Catégories',
              short_name: 'Catégories',
              url: `${basePath}#/finances/categories`,
            },
            {
              name: 'Saisons',
              short_name: 'Saisons',
              url: `${basePath}#/finances/seasons`,
            },
          ],
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
      ...(analyze
        ? [
            visualizer({
              filename: 'dist/stats.html',
              gzipSize: true,
              brotliSize: true,
              open: !process.env.CI,
            }) as PluginOption,
          ]
        : []),
    ],
  };
});
