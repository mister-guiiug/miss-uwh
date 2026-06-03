import { useMemo, useState } from 'react';
import { Filter, Plus, ScrollText } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { runningBalances } from '../../shared/lib/engine.ts';
import { categoryByCode } from '../../shared/lib/categories.ts';
import {
  PAYMENT_METHOD_LABELS,
  type JournalEntry,
} from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Money } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { EntrySheet } from './EntrySheet.tsx';

type SensFilter = 'all' | 'credit' | 'debit';

export function JournalScreen() {
  const season = useAppStore(selectActiveSeason);
  const allEntries = useAppStore(s => s.data.entries);
  const [query, setQuery] = useState('');
  const [sensFilter, setSensFilter] = useState<SensFilter>('all');
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const active = allEntries.filter(
      e => e.seasonId === season.id && !e.deletedAt
    );
    // Soldes calculés sur l'ensemble (chronologique), puis filtrage d'affichage.
    const withSolde = runningBalances(active, season.openingBalance);
    const q = query.trim().toLowerCase();
    return withSolde
      .filter(({ entry }) => {
        if (sensFilter !== 'all' && entry.sens !== sensFilter) return false;
        if (!q) return true;
        const cat = categoryByCode(entry.categoryCode);
        return (
          entry.label.toLowerCase().includes(q) ||
          entry.categoryCode.toLowerCase().includes(q) ||
          (cat?.label.toLowerCase().includes(q) ?? false)
        );
      })
      .reverse(); // plus récent en tête
  }, [allEntries, season, query, sensFilter]);

  const total = allEntries.filter(
    e => e.seasonId === season.id && !e.deletedAt
  ).length;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {total} écriture{total > 1 ? 's' : ''}
        </h2>
        <Button
          onClick={() => setCreating(true)}
          disabled={season.status === 'cloturee'}
        >
          <Plus size={18} aria-hidden="true" /> Écriture
        </Button>
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
            placeholder="Rechercher (libellé, catégorie)…"
            aria-label="Rechercher dans le journal"
            className="w-full min-h-10 rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={sensFilter}
          onChange={e => setSensFilter(e.target.value as SensFilter)}
          aria-label="Filtrer par sens"
          className="min-h-10 rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-3 text-sm"
        >
          <option value="all">Tout</option>
          <option value="credit">Recettes</option>
          <option value="debit">Dépenses</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={ScrollText} title="Journal vide">
          Ajoutez votre première écriture, ou importez votre fichier Excel
          depuis les réglages.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ entry, solde }) => {
            const cat = categoryByCode(entry.categoryCode);
            return (
              <li key={entry.id}>
                <button
                  onClick={() => setEditing(entry)}
                  disabled={season.status === 'cloturee'}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99] disabled:opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {entry.label}
                    </p>
                    <p className="truncate text-xs text-[var(--uwh-text-soft)]">
                      {formatDateShort(entry.date)} · {entry.categoryCode}
                      {cat ? ` ${cat.label}` : ''} ·{' '}
                      {PAYMENT_METHOD_LABELS[entry.method]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Money
                      value={
                        entry.sens === 'credit' ? entry.amount : -entry.amount
                      }
                      signed
                    />
                    <p className="tnum text-xs text-[var(--uwh-text-soft)]">
                      solde {solde.toLocaleString('fr-FR')} €
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <EntrySheet open entry={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <EntrySheet open entry={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
