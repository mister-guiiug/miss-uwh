import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { CATEGORIES } from '../../shared/lib/categories.ts';
import { categoryNet, isActive } from '../../shared/lib/engine.ts';
import type { Category } from '../../shared/types/domain.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Badge, Money } from '../../shared/components/badges.tsx';

interface RowProps {
  cat: Category;
  total: number;
  count: number;
  budget: number | undefined;
  showBudget: boolean;
  editable: boolean;
  onBudget: (amount: number) => void;
  onOpen: () => void;
}

function CategoryRow({
  cat,
  total,
  count,
  budget,
  showBudget,
  editable,
  onBudget,
  onOpen,
}: RowProps) {
  const ecart =
    budget != null ? Math.round((total - budget) * 100) / 100 : null;
  // Dépassement = dépense au-dessus du budget ; sous-réalisation = recette en deçà.
  const tone =
    ecart == null || budget === 0
      ? 'neutral'
      : cat.sens === 'depense'
        ? ecart > 0
          ? 'debit'
          : 'credit'
        : ecart < 0
          ? 'warn'
          : 'credit';

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">
            <span className="mr-1.5 text-[var(--uwh-text-soft)]">
              {cat.code}
            </span>
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
        </button>
        <Money value={total} className="shrink-0" />
      </div>

      {showBudget && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="text-[var(--uwh-text-soft)]">Budget</span>
          <input
            inputMode="decimal"
            aria-label={`Budget ${cat.code}`}
            disabled={!editable}
            defaultValue={budget ? String(budget) : ''}
            onBlur={e =>
              onBudget(Number(e.target.value.replace(',', '.')) || 0)
            }
            placeholder="0"
            className="w-24 rounded-lg border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-2 py-1 tnum"
          />
          {ecart != null && budget !== 0 && (
            <Badge tone={tone}>
              écart {ecart > 0 ? '+' : ''}
              {ecart.toLocaleString('fr-FR')} €
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function CategoriesScreen() {
  const season = useAppStore(selectActiveSeason);
  const entries = useAppStore(s => s.data.entries);
  const setBudget = useAppStore(s => s.setBudget);
  const [openCat, setOpenCat] = useState<Category | null>(null);
  const [showBudget, setShowBudget] = useState(false);

  const seasonEntries = useMemo(
    () => entries.filter(e => e.seasonId === season.id && isActive(e)),
    [entries, season]
  );
  const budget = season.budget ?? {};
  const editable = season.status !== 'cloturee';

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

  const renderCard = (title: string, cats: Category[], tone: string) => (
    <Card>
      <h3 className={`mb-1 font-display font-bold ${tone}`}>{title}</h3>
      <div className="divide-y divide-[var(--uwh-border)]">
        {cats.map(c => {
          const s = stat(c.code);
          return (
            <CategoryRow
              key={c.code}
              cat={c}
              total={s.total}
              count={s.count}
              budget={budget[c.code]}
              showBudget={showBudget}
              editable={editable}
              onBudget={amount => setBudget(season.id, c.code, amount)}
              onOpen={() => setOpenCat(c)}
            />
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowBudget(v => !v)}
          aria-pressed={showBudget}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
            showBudget
              ? 'bg-primary text-white'
              : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
          }`}
        >
          <Target size={15} aria-hidden="true" /> Budget prév./réalisé
        </button>
      </div>

      {renderCard('Recettes', recettes, 'text-[var(--uwh-credit)]')}
      {renderCard('Dépenses', depenses, 'text-[var(--uwh-debit)]')}

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
