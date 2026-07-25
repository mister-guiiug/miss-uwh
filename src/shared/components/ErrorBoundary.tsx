import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Download, Home, RotateCcw } from 'lucide-react';
import { recordError } from '@mister-guiiug/dev-wpa-config/react/observability';
import { STORAGE_KEY } from '../lib/storage.ts';
import { Button } from './Button.tsx';
import { useI18n } from '../../i18n/index.ts';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * `app` (défaut) : écran de secours plein, pour un crash catastrophique.
   * `route` : encart compact ; l'en-tête et la navigation restent utilisables.
   */
  level?: 'app' | 'route';
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Capture les erreurs de rendu pour éviter l'**écran blanc**. Crucial pour une
 * app local-first : on n'efface jamais les données, et l'écran de secours
 * propose d'**exporter une sauvegarde** (lecture directe du localStorage, donc
 * fonctionnelle même si React est cassé) avant de recharger.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordError(error, {
      source: 'error-boundary',
      react: info.componentStack,
    });
    console.error('[miss-uwh] erreur de rendu', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.level === 'route' ? (
      <RouteFallback onRetry={this.reset} />
    ) : (
      <AppFallback error={error} onRetry={this.reset} />
    );
  }
}

/** Télécharge le snapshot brut du localStorage, sans dépendre de l'état React. */
function downloadBackup(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const url = URL.createObjectURL(
      new Blob([raw], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `miss-uwh-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    /* le bouton est un filet de sécurité : on n'aggrave pas par une exception */
  }
}

function AppFallback({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-5 p-6 text-center">
      <AlertTriangle
        size={44}
        className="text-[var(--uwh-debit)]"
        aria-hidden="true"
      />
      <div className="space-y-2">
        <h1 className="font-display text-xl font-bold">
          {t('errors.app.title')}
        </h1>
        <p className="text-sm text-[var(--uwh-text-soft)]">
          {t('errors.app.body')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={downloadBackup} variant="secondary">
          <Download size={18} aria-hidden="true" /> {t('errors.app.download')}
        </Button>
        <Button onClick={() => window.location.reload()}>
          <RotateCcw size={18} aria-hidden="true" /> {t('errors.app.reload')}
        </Button>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-[var(--uwh-text-soft)] underline"
      >
        {t('errors.app.retryNoReload')}
      </button>
      <details className="w-full max-w-md text-left">
        <summary className="cursor-pointer text-xs text-[var(--uwh-text-soft)]">
          {t('errors.app.technical')}
        </summary>
        <pre className="mt-2 overflow-auto rounded-xl bg-[var(--uwh-surface-2)] p-3 text-left text-xs">
          {error.message}
        </pre>
      </details>
    </div>
  );
}

function RouteFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <AlertTriangle
        size={32}
        className="text-[var(--uwh-debit)]"
        aria-hidden="true"
      />
      <p className="text-sm text-[var(--uwh-text-soft)]">
        {t('errors.route.body')}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onRetry}>
          <RotateCcw size={18} aria-hidden="true" /> {t('common.retry')}
        </Button>
        <Button
          onClick={() => {
            window.location.hash = '#/';
          }}
        >
          <Home size={18} aria-hidden="true" /> {t('common.home')}
        </Button>
      </div>
    </div>
  );
}
