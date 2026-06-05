import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles } from 'lucide-react';
import { Button } from '../shared/components/Button.tsx';

/** Bandeau PWA : nouvelle version disponible. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-4 shadow-lg uwh-rise no-print"
    >
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles
          size={18}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        Une nouvelle version de Miss UWH est prête.
      </p>
      <div className="flex gap-2">
        <Button block onClick={() => updateServiceWorker(true)}>
          Mettre à jour
        </Button>
        <Button variant="secondary" block onClick={() => setNeedRefresh(false)}>
          Plus tard
        </Button>
      </div>
    </div>
  );
}
