import { Link } from 'react-router-dom';
import { CloudOff, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { ConnectionBanner } from '@mister-guiiug/dev-wpa-config/react/connection-banner';
import { useAppStore } from '../store/useAppStore.ts';
import { useI18n } from '../i18n/index.ts';
import { IS_SUPABASE } from './config.ts';
import { retryDeadOps, retrySync } from './sync.ts';

const ACTION_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-semibold';

/**
 * Même bande que le bandeau de synchro : c'est la même place à l'écran, il
 * doit donc avoir la même tête. `rounded-none border-0 bg-…` neutralisent la
 * carte que `components.css` dessine par défaut — les utilitaires Tailwind
 * sont dans une couche postérieure à `@layer components`, ils l'emportent.
 */
const BAND_CLASS =
  'no-print flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-none border-0 bg-[var(--uwh-warn)] px-3 py-1.5 text-center text-xs font-semibold text-white';

/**
 * Bandeau de statut de synchronisation, rendu DANS le flux sous l'en-tête
 * (jamais par-dessus). Quatre situations :
 * - `syncing`  : information discrète, synchronisation en cours ;
 * - `offline`  : hors ligne / serveur injoignable — état normal, ambre,
 *                les modifications en attente repartiront seules ;
 * - `error`    : pull impossible ou opérations refusées par le serveur —
 *                rouge, avec « Réessayer » et le détail dans les Réglages ;
 * - file vide  : le réseau, et rien d'autre (voir ci-dessous).
 *
 * LE TROU QUE LA QUATRIÈME BRANCHE BOUCHE. `onOffline()` appelle
 * `reportQueueStatus()`, qui rend `ready` quand la file est VIDE — et ce
 * composant rendait `null` sur `ready`. Autrement dit : couper le réseau sans
 * rien avoir en attente, le cas de très loin le plus fréquent (on consulte un
 * bilan dans un gymnase), n'affichait STRICTEMENT RIEN. L'app ne disait « hors
 * ligne » qu'à ceux qui avaient déjà écrit quelque chose. Le commentaire
 * d'`onOffline` — « reflète immédiatement l'état » — décrivait une intention
 * que le rendu ne tenait pas.
 *
 * POURQUOI LE COMPOSANT DU PAQUET ICI, ET PAS AILLEURS. Il est TEMPORISÉ :
 * 1,5 s de coupure continue avant de parler. C'est ce qu'il faut pour un signal
 * qui ne dépend QUE du réseau — un gymnase en limite de couverture ferait
 * clignoter un bandeau nu, et un bandeau qui clignote finit ignoré. Les autres
 * branches, elles, ne clignotent pas : elles décrivent une file qui, elle, ne
 * varie pas à la seconde.
 *
 * ET SURTOUT : les deux s'excluent PAR CONSTRUCTION, puisque c'est un
 * `if`/`else` du même composant. Il n'y a jamais deux bandeaux empilés sous
 * l'en-tête — `UpdatePrompt`, lui, flotte en bas de l'écran.
 */
export function SyncBanner() {
  const sync = useAppStore(s => s.syncStatus);
  const { t } = useI18n();

  if (!IS_SUPABASE) return null;
  if (sync.state === 'idle' || sync.state === 'ready') {
    return (
      <ConnectionBanner
        className={BAND_CLASS}
        label={
          <>
            <CloudOff size={14} aria-hidden="true" className="shrink-0" />
            {/* Le texte existait déjà et n'était presque jamais atteint :
                rien n'attend, seules les DONNÉES DÉJÀ LÀ comptent. C'est
                exactement ce qu'il faut dire ici. */}
            <span className="min-w-0 max-w-full">
              {t('sync.offlineAvailable', { cause: t('sync.offline') })}
            </span>
          </>
        }
      />
    );
  }

  const dead = sync.dead ?? 0;
  const pending = sync.pending ?? 0;

  let background = 'var(--color-primary)';
  let icon = <Info size={14} aria-hidden="true" className="shrink-0" />;
  let message = t('sync.syncing');
  let showRetry = false;

  if (sync.state === 'offline') {
    const offline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    const cause = offline ? t('sync.offline') : t('sync.unreachable');
    background = 'var(--uwh-warn)';
    icon = <CloudOff size={14} aria-hidden="true" className="shrink-0" />;
    message =
      pending > 0
        ? t('sync.offlinePending', { cause, n: pending })
        : t('sync.offlineAvailable', { cause });
    showRetry = true;
  } else if (sync.state === 'error') {
    background = 'var(--uwh-debit)';
    icon = <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />;
    message =
      dead > 0
        ? t('sync.incomplete', { error: sync.error ?? '' })
        : sync.error
          ? t('sync.interruptedError', { error: sync.error })
          : t('sync.interrupted');
    showRetry = true;
  } else {
    icon = (
      <CloudOff
        size={14}
        aria-hidden="true"
        className="animate-pulse shrink-0"
      />
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1.5 text-xs font-semibold text-white"
      style={{ background }}
    >
      {icon}
      <span className="min-w-0 max-w-full">{message}</span>
      {showRetry && (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void (dead > 0 ? retryDeadOps() : retrySync())}
            className={ACTION_CLASS}
          >
            <RefreshCw size={12} aria-hidden="true" /> {t('common.retry')}
          </button>
          {dead > 0 && (
            <Link to="/settings" className={ACTION_CLASS}>
              {t('common.details')}
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
