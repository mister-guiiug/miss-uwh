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
   * Clé de projet PostHog (`phc_…`), nuage EUROPÉEN — ADR 0012. LA MÊME pour
   * tout le parc : un seul projet, les applications distinguées dedans par la
   * super-propriété `app_name` que le socle déduit du chemin de base. Publique
   * par conception (elle part dans le bundle), donc `vars` et jamais
   * `secrets`. Absente, le bandeau de consentement ne rend rien et rien n'est
   * mesuré : c'est le seul interrupteur.
   */
  readonly VITE_POSTHOG_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injecté par Vite (define) — version applicative depuis package.json. */
declare const __APP_VERSION__: string;
