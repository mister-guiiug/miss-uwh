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

/** Octets → libellé lisible (fr). */
function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const value = mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${value.toLocaleString('fr-FR')} Mo`;
}

function formatLastSync(ts: number): string {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return today
    ? `aujourd'hui à ${time}`
    : `${d.toLocaleDateString('fr-FR')} à ${time}`;
}

function SyncStateBadge({ state }: { state: string }) {
  switch (state) {
    case 'ready':
      return (
        <Badge tone="credit">
          <CheckCircle2 size={12} aria-hidden="true" /> Synchronisé
        </Badge>
      );
    case 'syncing':
      return (
        <Badge tone="primary">
          <RefreshCw size={12} aria-hidden="true" className="animate-spin" />{' '}
          Synchronisation…
        </Badge>
      );
    case 'offline':
      return (
        <Badge tone="warn">
          <CloudOff size={12} aria-hidden="true" /> Hors ligne
        </Badge>
      );
    case 'error':
      return (
        <Badge tone="debit">
          <TriangleAlert size={12} aria-hidden="true" /> Erreur
        </Badge>
      );
    default:
      return <Badge tone="neutral">En attente</Badge>;
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
        <h3 className="font-display font-bold">État de la base de données</h3>
      </div>

      <div className="flex flex-col divide-y divide-[var(--uwh-border)]">
        <Row label="Stockage">
          {BACKEND === 'supabase' ? (
            <Badge tone="primary">Supabase (cloud)</Badge>
          ) : (
            <Badge tone="neutral">Local (cet appareil)</Badge>
          )}
        </Row>

        {IS_SUPABASE && (
          <>
            <Row label="Synchronisation">
              <SyncStateBadge state={sync.state} />
            </Row>
            <Row label="Dernière synchro">
              {sync.lastSyncAt ? formatLastSync(sync.lastSyncAt) : '—'}
            </Row>
            <Row label="En attente d'envoi">
              {pending > 0 ? (
                <Badge tone="warn">{pending}</Badge>
              ) : (
                <span className="text-[var(--uwh-text-soft)]">aucune</span>
              )}
            </Row>
            <Row label="Refusées par le serveur">
              {dead.length > 0 ? (
                <Badge tone="debit">{dead.length}</Badge>
              ) : (
                <span className="text-[var(--uwh-text-soft)]">aucune</span>
              )}
            </Row>
          </>
        )}

        <Row label="Données">
          {entriesCount.toLocaleString('fr-FR')} écriture(s) ·{' '}
          {adherentsCount.toLocaleString('fr-FR')} adhérent(s) ·{' '}
          {seasonsCount.toLocaleString('fr-FR')} saison(s)
        </Row>

        {storage && (
          <Row label="Espace local utilisé">
            {formatBytes(storage.usage)}{' '}
            <span className="font-normal text-[var(--uwh-text-soft)]">
              sur {formatBytes(storage.quota)}
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
            Opérations refusées — vos autres modifications continuent de se
            synchroniser. Réessayez après correction, ou abandonnez-les.
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
                … et {dead.length - 8} autre(s)
              </li>
            )}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => void onRetry()} disabled={retrying}>
              <RefreshCw size={16} aria-hidden="true" /> Réessayer
            </Button>
            <Button variant="danger" onClick={() => setConfirmDiscard(true)}>
              <Trash2 size={16} aria-hidden="true" /> Abandonner
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
          <RefreshCw size={16} aria-hidden="true" /> Synchroniser maintenant
        </Button>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Abandonner ces opérations ?"
        danger
        confirmLabel="Abandonner"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => discardDeadOps()}
      >
        Les {dead.length} opération(s) refusée(s) par le serveur seront
        définitivement supprimées de cet appareil. Les données correspondantes
        ne seront PAS envoyées au serveur.
      </ConfirmDialog>
    </Card>
  );
}
