import { registerSW } from 'virtual:pwa-register';
import { Sparkles } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { useUpdatePrompt } from '@mister-guiiug/dev-wpa-config/react/use-update-prompt';
import { useI18n } from '../i18n/index.ts';

/** Bandeau PWA : nouvelle version disponible. L'état et l'application de la
 * mise à jour viennent du socle (`useUpdatePrompt`) ; seul l'habillage est
 * local. */
export function UpdatePrompt() {
  const { visible, update, dismiss } = useUpdatePrompt({ registerSW });
  const { t } = useI18n();

  if (!visible) return null;

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
        {t('pwa.ready')}
      </p>
      <div className="flex gap-2">
        <Button block onClick={() => void update()}>
          {t('common.update')}
        </Button>
        <Button variant="secondary" block onClick={dismiss}>
          {t('common.later')}
        </Button>
      </div>
    </div>
  );
}
