import { useMemo, useState } from 'react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { CATEGORIES } from '../../shared/lib/categories.ts';
import { categoryNet, isActive } from '../../shared/lib/engine.ts';
import type { Category } from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Badge, Money } from '../../shared/components/badges.tsx';

function CategoryRow({
  cat,
  total,
  count,
  onOpen,
}: {
  cat: Category;
  total: number;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          <span className="mr-1.5 text-[var(--uwh-text-soft)]">{cat.code}</span>
          {cat.label}
        </p>
        <div className="mt-0.5 flex gap-1.5">
          {count === 0 ? (
            <Badge tone="warn">à compléter</Badge>
          ) : (
            <span className="text-xs text-[var(--uwh-text-soft)]">
              {count} écriture{count > 1 ? 's' : ''}
            </span>
          )}
          {cat.kind !== 'exploitation' && (
            <Badge tone="neutral">{cat.kind}</Badge>
          )}
        </div>
      </div>
      <Money value={total} className="shrink-0" />
    </button>
  );
}

export function CategoriesScreen() {
  const season = useAppStore(selectActiveSeason);
  const entries = useAppStore(s => s.data.entries);
  const [openCat, setOpenCat] = useState<Category | null>(null);

  const seasonEntries = useMemo(
    () => entries.filter(e => e.seasonId === season.id && isActive(e)),
    [entries, season]
  );

  const stat = (code: string) => ({
    total: categoryNet(code, seasonEntries),
    count: seasonEntries.filter(e => e.categoryCode === code).length,
  });

  const recettes = CATEGORIES.filter(c => c.sens === 'recette');
  const depenses = CATEGORIES.filter(c => c.sens === 'depense');
  const detail = openCat
    ? seasonEntries
        .filter(e => e.categoryCode === openCat.code)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <h3 className="mb-1 font-display font-bold text-[var(--uwh-credit)]">
          Recettes
        </h3>
        <div className="divide-y divide-[var(--uwh-border)]">
          {recettes.map(c => {
            const s = stat(c.code);
            return (
              <CategoryRow
                key={c.code}
                cat={c}
                total={s.total}
                count={s.count}
                onOpen={() => setOpenCat(c)}
              />
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 font-display font-bold text-[var(--uwh-debit)]">
          Dépenses
        </h3>
        <div className="divide-y divide-[var(--uwh-border)]">
          {depenses.map(c => {
            const s = stat(c.code);
            return (
              <CategoryRow
                key={c.code}
                cat={c}
                total={s.total}
                count={s.count}
                onOpen={() => setOpenCat(c)}
              />
            );
          })}
        </div>
      </Card>

      <Sheet
        open={!!openCat}
        title={openCat ? `${openCat.code} — ${openCat.label}` : ''}
        onClose={() => setOpenCat(null)}
      >
        {detail.length === 0 ? (
          <p className="text-sm text-[var(--uwh-text-soft)]">
            Aucune écriture dans cette catégorie pour la saison {season.label}.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--uwh-border)]">
            {detail.map(e => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-[var(--uwh-text-soft)]">
                    {formatDateShort(e.date)}
                  </p>
                </div>
                <Money
                  value={e.sens === 'credit' ? e.amount : -e.amount}
                  signed
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
