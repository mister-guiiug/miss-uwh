/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Backend de données : "local" (défaut) ou "supabase". */
  readonly VITE_BACKEND?: 'local' | 'supabase';
  /** URL du projet Supabase (publique). */
  readonly VITE_SUPABASE_URL?: string;
  /** Clé anon Supabase (publique, protégée par RLS côté serveur). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injecté par Vite (define) — version applicative depuis package.json. */
declare const __APP_VERSION__: string;
