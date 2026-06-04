import { Heart } from 'lucide-react';
import { REPO_URL, SPONSOR_URL } from '../lib/links.ts';

/** GitHub mark inline (lucide 1.x ne fournit plus les icônes de marque). */
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.56-.3-5.26-1.28-5.26-5.7 0-1.26.45-2.3 1.2-3.1-.12-.3-.52-1.48.1-3.1 0 0 .98-.3 3.2 1.2a11 11 0 0 1 5.83 0c2.2-1.5 3.18-1.2 3.18-1.2.63 1.62.23 2.8.12 3.1.74.8 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.28 5.69.42.36.78 1.07.78 2.16v3.2c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function AppFooter() {
  return (
    <footer className="no-print pt-1 text-center text-xs text-[var(--uwh-text-soft)]">
      <div className="flex items-center justify-center gap-4">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-primary"
        >
          <GitHubMark />
          Code source
        </a>
        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-primary"
        >
          <Heart size={15} aria-hidden="true" />
          Soutenir
        </a>
      </div>
    </footer>
  );
}
