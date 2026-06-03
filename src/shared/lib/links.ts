/** Liens externes de l'application : code source et sponsor (règle famille). */
export const REPO_URL = 'https://github.com/mister-guiiug/miss-uwh';
export const SPONSOR_URL = 'https://buymeacoffee.com/mister.guiiug';

/** URL canonique de l'app (gère le base path GitHub Pages). */
export function appUrl(): string {
  try {
    const base = import.meta.env.BASE_URL || '/';
    return new URL(base, globalThis.location.origin).href;
  } catch {
    return 'https://mister-guiiug.github.io/miss-uwh/';
  }
}
