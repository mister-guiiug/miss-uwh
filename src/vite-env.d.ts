/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Backend de données : "local" (défaut) ou "supabase". */
  readonly VITE_BACKEND?: 'local' | 'supabase';
  /** URL du projet Supabase (publique). */
  readonly VITE_SUPABASE_URL?: string;
  /** Clé anon Supabase (publique, protégée par RLS côté serveur). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** DSN Sentry (optionnel) : vide = observabilité locale seule (no-op). */
  readonly VITE_SENTRY_DSN?: string;
  /**
   * Identifiant de mesure GA4 (`G-…`), propre à CETTE application. Absent, le
   * bandeau de consentement ne rend rien et rien n'est mesuré : c'est le seul
   * interrupteur.
   */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injecté par Vite (define) — version applicative depuis package.json. */
declare const __APP_VERSION__: string;
