import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pwaSeoPlugin } from '@mister-guiiug/dev-pwa-config/vite-pwa-base';
import { cspPlugin } from '@mister-guiiug/dev-pwa-config/vite-csp';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync } from 'node:fs';
import { versionPlugin } from '@mister-guiiug/dev-pwa-config/vite-version';
import { NAVIGATE_FALLBACK_DENY_FILES } from '@mister-guiiug/dev-pwa-config/vite-pwa';
import { AI_PROVIDER_ORIGINS } from './src/shared/lib/aiOrigins.ts';

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
    // `react/observability` porte DEUX chemins de chargement : celui que
    // `loader` fournit (analysable, utilisé ici depuis que la peer est
    // installée) et un repli au spécificateur volontairement non analysable,
    // annoté `/* @vite-ignore */`. Le second est toujours dans le module, et
    // le pré-bundling de dev perd l'annotation : la résolution échoue, 500 sur
    // toute la page. L'exclusion reste donc nécessaire. Le build de prod n'est
    // pas concerné.
    optimizeDeps: {
      exclude: ['@mister-guiiug/dev-pwa-config/react/observability'],
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          /*
           * LE MORCEAU SENTRY GARDE SON NOM, SANS EMPREINTE — parce qu'il est
           * exclu du précache (`globIgnores` plus bas) et qu'une URL empreintée
           * y meurt à chaque déploiement.
           *
           * Le service worker sert la coquille précachée jusqu'à ce que
           * l'utilisateur accepte la mise à jour ; cette coquille demande
           * l'ANCIENNE empreinte, que le déploiement suivant a supprimée de
           * `assets/`. Mesuré en production sur mister-qowa le 22/09/2026 :
           * HTTP 404, « Échec du chargement pour le module » dans la console.
           * `initSentry` avale l'échec (son `try/catch`), donc l'application ne
           * casse pas — elle rapporte ses erreurs à personne, sans le dire.
           *
           * Rien n'est perdu au cache : GitHub Pages répond
           * `Cache-Control: max-age=600` sur TOUS les fichiers, empreinte ou pas.
           *
           * `pwa-doctor` tient l'invariant depuis le socle 6.8.0
           * (règle `chunk-hors-precache`).
           */
          chunkFileNames: chunk =>
            chunk.name === 'sentry'
              ? 'assets/sentry.js'
              : 'assets/[name]-[hash].js',
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
            // Le générateur PDF du socle n'est tiré que par l'export du bilan,
            // lui-même chargé à la demande. Sans cette ligne il tomberait dans
            // `vendor`, chargé d'emblée : trois kilo-octets payés à chaque
            // ouverture pour un bouton pressé une fois par an.
            if (norm.includes('/dev-pwa-config/pdf')) return 'pdf';
            // Même raison pour le traitement d'image du socle : seule la
            // lecture des justificatifs s'en sert, et elle est chargée au
            // geste. Sans cette ligne, `vendor` — préchargé — le portait.
            if (norm.includes('/dev-pwa-config/image')) return 'image';
            // Sentry est chargé par un `import()` que `loader` rend analysable.
            // Sans cette ligne il tomberait dans `vendor`, qui est PRÉCHARGÉ :
            // mesuré le 16/09/2026, 381,9 kB préchargés au lieu de 227,2 — pour
            // un total gzip identique à 0,1 kB près. Le total ne voit pas la
            // différence, `bundleBudget.preloadGzipKb` si.
            if (norm.includes('/@sentry/')) return 'sentry';
            // ET POSTHOG POUR LA MÊME RAISON, EN PLUS GRAVE. Sentry préchargé
            // coûtait du poids ; PostHog préchargé casse une PROMESSE : l'ADR
            // 0012 dit que rien n'est chargé avant l'accord, et le socle ne
            // l'appelle qu'après. Sans cette ligne, la bibliothèque tombe dans
            // `vendor`, qui est PRÉCHARGÉ — elle serait donc téléchargée chez
            // un visiteur qui refuse. Mesuré le 19/09/2026 : 274,4 kB
            // préchargés au lieu de 227,2. C'est `preloadGzipKb` qui l'a vu,
            // pas le total.
            if (norm.includes('/posthog-js/')) return 'posthog';
            if (norm.includes('/zustand/')) return 'zustand';
            if (norm.includes('/zod/')) return 'zod';
            return 'vendor';
          },
        },
      },
    },
    plugins: [
      // AVANT cspPlugin : il pose un script inline dans le <head>, que la
      // CSP doit hacher après coup ; et il écrit version.json au build.
      versionPlugin({ manifest: true, define: false }),
      react(),
      tailwindcss(),
      // SEO partagé famille : canonical/OG via placeholders index.html +
      // sitemap.xml/robots.txt générés au build.
      pwaSeoPlugin({
        // Deux <meta name="theme-color"> par schéma : la barre du navigateur suit
        // le mode sombre dès le premier rendu (relevé du 02/09/2026 : 5 apps sur 16).
        themeColor: { light: '#f3f6fc', dark: '#0a1626' },
        siteName: 'Miss UWH',
        basePath,
        logoPath: '/icons/icon-512.png',
      }),
      // CSP durcie : script-src par hash SHA-256 des scripts inline (anti-FOUC +
      // bascule media des polices), plus de 'unsafe-inline'. Directives portées
      // depuis l'ancienne meta statique (Google Fonts + Supabase https/wss).
      cspPlugin({
        dev: command === 'serve',
        // `analytics` ouvre les hôtes de PostHog — le nuage EUROPÉEN (ADR
        // 0012). Sans lui, l'ingestion que `ConsentBanner` déclenche APRÈS
        // l'accord serait refusée par la politique — et l'échec ne se verrait
        // qu'en console, sur le site déployé, une fois le consentement donné.
        analytics: true,
        // Les fournisseurs d'IA « apportez votre clé » (génération
        // d'exercices, lecture des justificatifs) sont appelés DEPUIS LE
        // NAVIGATEUR : sans leurs origines ici, chaque appel était bloqué en
        // production — la génération d'exercices l'était depuis la pose de
        // cette CSP (25/07/2026). La liste vit dans `aiOrigins.ts`, que le
        // client relit pour refuser d'avance un point d'accès hors liste.
        connectSrc: [
          "'self'",
          'https://*.supabase.co',
          'wss://*.supabase.co',
          ...AI_PROVIDER_ORIGINS,
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        extraDirectives: { 'frame-ancestors': "'none'" },
      }),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/apple-touch-icon.png',
        ],
        workbox: {
          // Un fichier (sitemap.xml, llms.txt…) va au réseau, pas à index.html.
          navigateFallbackDenylist: [NAVIGATE_FALLBACK_DENY_FILES],
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,webmanifest}'],
          /*
           * LE MORCEAU SENTRY HORS DU PRÉCACHE, sans quoi tout le découpage
           * ci-dessus ne servirait à rien. `globPatterns` ramasse TOUT le JS
           * émis, `import()` ou pas : mesuré le 16/09/2026, le précache passait
           * de 1 264 à 1 728 KiB à la seule installation du paquet, soit 464 KiB
           * bruts téléchargés par chaque visiteur — DSN posé ou non.
           *
           * Hors précache, il est cherché sur le réseau à la première erreur, et
           * jamais si l'observabilité reste éteinte. Ne pas l'avoir hors ligne
           * est sans conséquence : rapporter une erreur demande le réseau.
           */
          globIgnores: ['**/sentry.js', '**/sentry-*.js'],
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
          screenshots: [
            {
              src: 'screenshots/mobile.png',
              sizes: '824x1830',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Écran d’accueil sur mobile',
            },
            {
              src: 'screenshots/wide.png',
              sizes: '2560x1600',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Écran d’accueil sur ordinateur',
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
