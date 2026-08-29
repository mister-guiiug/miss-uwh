import { useMemo, useState } from 'react';
import { ShieldCheck, Trash2, RotateCcw } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { formatDateTime } from '../../shared/lib/format.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { Badge, Money } from '../../shared/components/badges.tsx';
import { EmptyState } from '@mister-guiiug/dev-wpa-config/react/empty-state';
import type { AuditCategory } from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';

type Tab = 'all' | AuditCategory;

export function AuditScreen() {
  const { t } = useI18n();
  const audit = useAppStore(s => s.data.audit);
  const entries = useAppStore(s => s.data.entries);
  const season = useAppStore(selectActiveSeason);
  const restoreEntry = useAppStore(s => s.restoreEntry);
  const [tab, setTab] = useState<Tab>('all');

  const events = useMemo(
    () =>
      [...audit]
        .filter(e => tab === 'all' || e.category === tab)
        .sort((a, b) => b.ts - a.ts),
    [audit, tab]
  );

  // Écritures supprimées (restaurables) de la saison active.
  const deleted = entries.filter(e => e.seasonId === season.id && e.deletedAt);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t('finances.audit.tabAll') },
    { key: 'metier', label: t('enums.auditCategory.metier') },
    { key: 'securite', label: t('enums.auditCategory.securite') },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold">
          {t('finances.audit.title')}
        </h2>
      </div>

      <div className="flex gap-1.5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              tab === t.key
                ? 'bg-primary text-white'
                : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {deleted.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Trash2
              size={15}
              className="text-[var(--uwh-debit)]"
              aria-hidden="true"
            />
            {t('finances.audit.deletedEntries', { n: deleted.length })}
          </div>
          <ul className="flex flex-col gap-1.5">
            {deleted.map(e => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate text-sm">{e.label}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Money
                    value={e.sens === 'credit' ? e.amount : -e.amount}
                    signed
                  />
                  <Button
                    variant="ghost"
                    aria-label={t('finances.audit.restore')}
                    onClick={() => restoreEntry(e.id)}
                    disabled={season.status === 'cloturee'}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={28} aria-hidden="true" />}
          title={t('finances.audit.emptyTitle')}
          description={t('finances.audit.emptyBody')}
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {events.map(e => (
            <li
              key={e.id}
              className="rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[var(--uwh-text-soft)]">
                  {e.action}
                </span>
                <Badge tone={e.category === 'securite' ? 'warn' : 'neutral'}>
                  {t(`enums.auditCategory.${e.category}` as TKey)}
                </Badge>
              </div>
              <p className="mt-1 text-sm">{e.summary}</p>
              <p className="mt-0.5 text-xs text-[var(--uwh-text-soft)]">
                {formatDateTime(e.ts)} · {e.actor}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
