import { useEffect, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Database,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.ts';
import { BACKEND, IS_SUPABASE } from '../../backend/config.ts';
import { discardDeadOps, retryDeadOps, retrySync } from '../../backend/sync.ts';
import { describeRemoteOp } from '../../backend/syncBus.ts';
import { deadItems } from '../../backend/syncQueue.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';
import { useI18n, type TKey } from '../../i18n/index.ts';

type Translate = (
  key: TKey,
  params?: Record<string, string | number>
) => string;

/** Octets → libellé lisible (localisé). */
function formatBytes(bytes: number, t: Translate): string {
  const mb = bytes / (1024 * 1024);
  const value = mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return t('database.megabytes', { value: value.toLocaleString('fr-FR') });
}

function formatLastSync(ts: number, t: Translate): string {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return today
    ? t('database.todayAt', { time })
    : t('database.dateAt', { date: d.toLocaleDateString('fr-FR'), time });
}

function SyncStateBadge({ state }: { state: string }) {
  const { t } = useI18n();
  switch (state) {
    case 'ready':
      return (
        <Badge tone="credit">
          <CheckCircle2 size={12} aria-hidden="true" /> {t('database.synced')}
        </Badge>
      );
    case 'syncing':
      return (
        <Badge tone="primary">
          <RefreshCw size={12} aria-hidden="true" className="animate-spin" />{' '}
          {t('sync.syncing')}
        </Badge>
      );
    case 'offline':
      return (
        <Badge tone="warn">
          <CloudOff size={12} aria-hidden="true" /> {t('sync.offline')}
        </Badge>
      );
    case 'error':
      return (
        <Badge tone="debit">
          <TriangleAlert size={12} aria-hidden="true" /> {t('database.error')}
        </Badge>
      );
    default:
      return <Badge tone="neutral">{t('database.waiting')}</Badge>;
  }
}

/** Ligne label/valeur compacte, pensée pour les petits écrans (retours à la ligne ok). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1 text-sm">
      <span className="text-[var(--uwh-text-soft)]">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

/**
 * Réglages → « État de la base de données » : mode de stockage, état de la
 * synchronisation (dernière synchro, opérations en attente / refusées avec
 * rejeu ou abandon), volumétrie des données et espace local utilisé.
 */
export function DatabaseStatusCard() {
  const { t } = useI18n();
  const sync = useAppStore(s => s.syncStatus);
  const entriesCount = useAppStore(
    s => s.data.entries.filter(e => !e.deletedAt).length
  );
  const adherentsCount = useAppStore(s => s.data.adherents.length);
  const seasonsCount = useAppStore(s => s.data.seasons.length);

  const [storage, setStorage] = useState<{ usage: number; quota: number }>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    let cancelled = false;
    void navigator.storage.estimate().then(({ usage, quota }) => {
      if (!cancelled && usage !== undefined && quota !== undefined)
        setStorage({ usage, quota });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Relu à chaque rendu : `sync.dead` (réactif) change à chaque évolution de la
  // file, ce qui re-rend la carte et rafraîchit la liste.
  const dead = IS_SUPABASE ? deadItems() : [];
  const pending = sync.pending ?? 0;

  async function onRetry() {
    setRetrying(true);
    try {
      await (dead.length > 0 ? retryDeadOps() : retrySync());
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Database size={16} className="text-primary" aria-hidden="true" />
        <h3 className="font-display font-bold">{t('database.title')}</h3>
      </div>

      <div className="flex flex-col divide-y divide-[var(--uwh-border)]">
        <Row label={t('database.storage')}>
          {BACKEND === 'supabase' ? (
            <Badge tone="primary">{t('database.supabase')}</Badge>
          ) : (
            <Badge tone="neutral">{t('database.local')}</Badge>
          )}
        </Row>

        {IS_SUPABASE && (
          <>
            <Row label={t('database.sync')}>
              <SyncStateBadge state={sync.state} />
            </Row>
            <Row label={t('database.lastSync')}>
              {sync.lastSyncAt ? formatLastSync(sync.lastSyncAt, t) : '—'}
            </Row>
            <Row label={t('database.pending')}>
              {pending > 0 ? (
                <Badge tone="warn">{pending}</Badge>
              ) : (
                <span className="text-[var(--uwh-text-soft)]">
                  {t('database.none')}
                </span>
              )}
            </Row>
            <Row label={t('database.rejected')}>
              {dead.length > 0 ? (
                <Badge tone="debit">{dead.length}</Badge>
              ) : (
                <span className="text-[var(--uwh-text-soft)]">
                  {t('database.none')}
                </span>
              )}
            </Row>
          </>
        )}

        <Row label={t('database.data')}>
          {t('database.counts', {
            entries: entriesCount.toLocaleString('fr-FR'),
            members: adherentsCount.toLocaleString('fr-FR'),
            seasons: seasonsCount.toLocaleString('fr-FR'),
          })}
        </Row>

        {storage && (
          <Row label={t('database.localSpace')}>
            {formatBytes(storage.usage, t)}{' '}
            <span className="font-normal text-[var(--uwh-text-soft)]">
              {t('database.of', { quota: formatBytes(storage.quota, t) })}
            </span>
          </Row>
        )}
      </div>

      {sync.state === 'error' && sync.error && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--uwh-debit)_10%,transparent)] p-2.5 text-xs text-[var(--uwh-debit)]"
        >
          <TriangleAlert
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0 break-words">{sync.error}</span>
        </p>
      )}

      {dead.length > 0 && (
        <div className="mt-3 rounded-xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--uwh-text-soft)]">
            {t('database.rejectedDesc')}
          </p>
          <ul className="flex flex-col gap-2">
            {dead.slice(0, 8).map(item => (
              <li key={item.id} className="text-xs">
                <span className="font-semibold">
                  {describeRemoteOp(item.op)}
                </span>
                {item.lastError && (
                  <span className="block break-words text-[var(--uwh-text-soft)]">
                    {item.lastError}
                  </span>
                )}
              </li>
            ))}
            {dead.length > 8 && (
              <li className="text-xs text-[var(--uwh-text-soft)]">
                {t('database.andMore', { n: dead.length - 8 })}
              </li>
            )}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => void onRetry()} disabled={retrying}>
              <RefreshCw size={16} aria-hidden="true" /> {t('common.retry')}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDiscard(true)}>
              <Trash2 size={16} aria-hidden="true" /> {t('database.discard')}
            </Button>
          </div>
        </div>
      )}

      {IS_SUPABASE && dead.length === 0 && (
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => void onRetry()}
          disabled={retrying || sync.state === 'syncing'}
        >
          <RefreshCw size={16} aria-hidden="true" /> {t('database.syncNow')}
        </Button>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title={t('database.discardTitle')}
        danger
        confirmLabel={t('database.discard')}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => discardDeadOps()}
      >
        {t('database.discardBody', { n: dead.length })}
      </ConfirmDialog>
    </Card>
  );
}
