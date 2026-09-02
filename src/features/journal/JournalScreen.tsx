import { useMemo, useState } from 'react';
import {
  CircleCheck,
  CircleDashed,
  Filter,
  Landmark,
  Plus,
  ScrollText,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { runningBalances } from '../../shared/lib/engine.ts';
import { allCategories, categoryByCode } from '../../shared/lib/categories.ts';
import {
  PAYMENT_METHODS,
  type JournalEntry,
} from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { Money } from '../../shared/components/badges.tsx';
import { EmptyState } from '@mister-guiiug/dev-wpa-config/react/empty-state';
import { VirtualList } from '../../shared/components/VirtualList.tsx';
import { EntrySheet } from './EntrySheet.tsx';
import { ReconcileSheet } from '../reconcile/ReconcileSheet.tsx';
import { getDefaultLocale } from '@mister-guiiug/dev-wpa-config/format';

type SensFilter = 'all' | 'credit' | 'debit';
type RecFilter = 'all' | 'yes' | 'no';

const controlClass =
  'min-h-10 rounded-xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-2 text-sm';

export function JournalScreen() {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const allEntries = useAppStore(s => s.data.entries);
  const allEvents = useAppStore(s => s.data.events);
  const setReconciled = useAppStore(s => s.setReconciled);
  const events = allEvents.filter(e => e.seasonId === season.id);

  const [query, setQuery] = useState('');
  const [sensFilter, setSensFilter] = useState<SensFilter>('all');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [eventId, setEventId] = useState('');
  const [recFilter, setRecFilter] = useState<RecFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [reconcile, setReconcile] = useState(false);

  const rows = useMemo(() => {
    const active = allEntries.filter(
      e => e.seasonId === season.id && !e.deletedAt
    );
    const withSolde = runningBalances(active, season.openingBalance);
    const q = query.trim().toLowerCase();
    return withSolde
      .filter(({ entry }) => {
        if (sensFilter !== 'all' && entry.sens !== sensFilter) return false;
        if (category && entry.categoryCode !== category) return false;
        if (method && entry.method !== method) return false;
        if (eventId && entry.eventId !== eventId) return false;
        if (recFilter === 'yes' && !entry.reconciled) return false;
        if (recFilter === 'no' && entry.reconciled) return false;
        if (dateFrom && entry.date < dateFrom) return false;
        if (dateTo && entry.date > dateTo) return false;
        if (!q) return true;
        const cat = categoryByCode(entry.categoryCode);
        return (
          entry.label.toLowerCase().includes(q) ||
          entry.categoryCode.toLowerCase().includes(q) ||
          (cat?.label.toLowerCase().includes(q) ?? false)
        );
      })
      .reverse();
  }, [
    allEntries,
    season,
    query,
    sensFilter,
    category,
    method,
    eventId,
    recFilter,
    dateFrom,
    dateTo,
  ]);

  const active = allEntries.filter(
    e => e.seasonId === season.id && !e.deletedAt
  );
  const reconciledCount = active.filter(e => e.reconciled).length;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">
            {t('finances.journal.entryCount', { n: active.length })}
          </h2>
          <p className="text-xs text-[var(--uwh-text-soft)]">
            {t('finances.journal.reconciledCount', {
              done: reconciledCount,
              total: active.length,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-label={t('finances.journal.reconcileAria')}
            onClick={() => setReconcile(true)}
          >
            <Landmark size={18} aria-hidden="true" />
          </Button>
          <Button
            onClick={() => setCreating(true)}
            disabled={season.status === 'cloturee'}
          >
            <Plus size={18} aria-hidden="true" />{' '}
            {t('finances.journal.addEntry')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Filter
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--uwh-text-soft)]"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('finances.journal.searchPlaceholder')}
            aria-label={t('finances.journal.searchAria')}
            className="min-h-10 w-full rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] pl-9 pr-3 text-sm"
          />
        </div>
        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          aria-label={t('finances.journal.filtersAria')}
          aria-pressed={showFilters}
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--uwh-border)] p-3">
          <select
            aria-label={t('finances.journal.sensAria')}
            className={controlClass}
            value={sensFilter}
            onChange={e => setSensFilter(e.target.value as SensFilter)}
          >
            <option value="all">{t('finances.journal.allSens')}</option>
            <option value="credit">{t('finances.journal.income')}</option>
            <option value="debit">{t('finances.journal.expenses')}</option>
          </select>
          <select
            aria-label={t('finances.journal.reconciliationAria')}
            className={controlClass}
            value={recFilter}
            onChange={e => setRecFilter(e.target.value as RecFilter)}
          >
            <option value="all">{t('finances.journal.recAll')}</option>
            <option value="yes">{t('finances.journal.recYes')}</option>
            <option value="no">{t('finances.journal.recNo')}</option>
          </select>
          <select
            aria-label={t('common.category')}
            className={controlClass}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">{t('finances.journal.allCategories')}</option>
            {allCategories().map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
          <select
            aria-label={t('finances.journal.methodAria')}
            className={controlClass}
            value={method}
            onChange={e => setMethod(e.target.value)}
          >
            <option value="">{t('finances.journal.allMethods')}</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>
                {t(`enums.paymentMethod.${m}` as TKey)}
              </option>
            ))}
          </select>
          {events.length > 0 && (
            <select
              aria-label={t('finances.journal.eventAria')}
              className={`${controlClass} col-span-2`}
              value={eventId}
              onChange={e => setEventId(e.target.value)}
            >
              <option value="">{t('finances.journal.allEvents')}</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          )}
          <label className="flex flex-col gap-0.5 text-xs text-[var(--uwh-text-soft)]">
            {t('finances.journal.dateFrom')}
            <input
              type="date"
              className={controlClass}
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-[var(--uwh-text-soft)]">
            {t('finances.journal.dateTo')}
            <input
              type="date"
              className={controlClass}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={28} aria-hidden="true" />}
          title={t('finances.journal.emptyTitle')}
          description={t('finances.journal.emptyBody')}
        />
      ) : (
        <VirtualList
          items={rows}
          getKey={({ entry }) => entry.id}
          estimateRowHeight={64}
          ariaLabel={t('finances.journal.listAria')}
        >
          {({ entry, solde }) => {
            const cat = categoryByCode(entry.categoryCode);
            return (
              <div className="flex items-stretch gap-1.5">
                <button
                  onClick={() => setReconciled(entry.id, !entry.reconciled)}
                  disabled={season.status === 'cloturee'}
                  aria-label={
                    entry.reconciled
                      ? t('finances.journal.unreconcile')
                      : t('finances.journal.reconcile')
                  }
                  aria-pressed={!!entry.reconciled}
                  className="flex shrink-0 items-center justify-center rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] px-3 disabled:opacity-70"
                >
                  {entry.reconciled ? (
                    <CircleCheck
                      size={18}
                      className="text-[var(--uwh-credit)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <CircleDashed
                      size={18}
                      className="text-[var(--uwh-text-soft)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  onClick={() => setEditing(entry)}
                  disabled={season.status === 'cloturee'}
                  className="flex flex-1 flex-col gap-1 overflow-hidden rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99] disabled:opacity-70"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {entry.label}
                    </span>
                    <Money
                      value={
                        entry.sens === 'credit' ? entry.amount : -entry.amount
                      }
                      signed
                      className="shrink-0"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--uwh-text-soft)]">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="tnum shrink-0 rounded-md bg-[var(--uwh-surface-2)] px-1.5 py-0.5 font-semibold">
                        {entry.categoryCode}
                      </span>
                      <span className="truncate">
                        {cat ? `${cat.label} · ` : ''}
                        {formatDateShort(entry.date)} ·{' '}
                        {t(`enums.paymentMethod.${entry.method}` as TKey)}
                      </span>
                    </span>
                    <span className="tnum shrink-0">
                      {t('finances.journal.balanceCell', {
                        value: solde.toLocaleString(getDefaultLocale()),
                      })}
                    </span>
                  </div>
                </button>
              </div>
            );
          }}
        </VirtualList>
      )}

      {creating && (
        <EntrySheet open entry={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <EntrySheet open entry={editing} onClose={() => setEditing(null)} />
      )}
      <ReconcileSheet open={reconcile} onClose={() => setReconcile(false)} />
    </div>
  );
}
