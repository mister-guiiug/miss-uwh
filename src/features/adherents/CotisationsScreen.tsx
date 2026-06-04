import { useMemo, useState } from 'react';
import { Check, Coins, X } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import type { Adherent } from '../../shared/types/domain.ts';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { CotisationSheet } from './CotisationSheet.tsx';

/** Suivi des cotisations (montant dû/réglé) par membre sur la saison active. */
export function CotisationsScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.adherents);
  const updateAdherent = useAppStore(s => s.updateAdherent);
  const [editing, setEditing] = useState<Adherent | null>(null);

  const rows = useMemo(
    () =>
      all
        .filter(a => a.seasonId === season.id)
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
            'fr'
          )
        ),
    [all, season.id]
  );

  const summary = useMemo(() => {
    const total = rows.reduce((s, a) => s + (a.amount ?? 0), 0);
    const collected = rows
      .filter(a => a.paid)
      .reduce((s, a) => s + (a.amount ?? 0), 0);
    const paidCount = rows.filter(a => a.paid).length;
    return { total, collected, paidCount, unpaid: rows.length - paidCount };
  }, [rows]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="rounded-2xl bg-[var(--uwh-surface-2)] p-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="credit">{summary.paidCount} à jour</Badge>
          {summary.unpaid > 0 && (
            <Badge tone="warn">
              {summary.unpaid} impayé{summary.unpaid > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-[var(--uwh-text-soft)]">
          Encaissé <strong>{formatEuro(summary.collected)}</strong> / attendu{' '}
          <strong>{formatEuro(summary.total)}</strong>
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Coins} title="Aucune cotisation">
          Ajoutez des membres dans l'onglet Membres.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(a => (
            <li key={a.id} className="flex items-stretch gap-1.5">
              <button
                onClick={() => updateAdherent(a.id, { paid: !a.paid })}
                aria-label={a.paid ? 'Marquer impayé' : 'Marquer réglé'}
                aria-pressed={a.paid}
                className="flex shrink-0 items-center justify-center rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] px-3"
              >
                {a.paid ? (
                  <Check
                    size={18}
                    className="text-[var(--uwh-credit)]"
                    aria-hidden="true"
                  />
                ) : (
                  <X
                    size={18}
                    className="text-[var(--uwh-warn)]"
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                onClick={() => setEditing(a)}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {a.firstName} {a.lastName}
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">
                  {formatEuro(a.amount ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CotisationSheet
          open
          member={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
