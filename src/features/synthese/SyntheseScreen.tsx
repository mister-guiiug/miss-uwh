import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, LineChart } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { useBilan } from '../../shared/hooks/useBilan.ts';
import { seasonTotals } from '../../shared/lib/engine.ts';
import { categoryColor } from '../../shared/lib/colors.ts';
import type { BilanLine } from '../../shared/lib/engine.ts';
import { Card } from '../../shared/components/Card.tsx';
import {
  DonutChart,
  type DonutSegment,
} from '../../shared/components/charts/DonutChart.tsx';
import {
  EvolutionChart,
  type EvolutionPoint,
} from '../../shared/components/charts/EvolutionChart.tsx';

function toSegments(lines: BilanLine[]): DonutSegment[] {
  return lines
    .filter(l => l.kind !== 'compensee' && l.total > 0)
    .map(l => ({
      label: l.label,
      value: l.total,
      color: categoryColor(l.code),
    }));
}

export function SyntheseScreen() {
  const season = useAppStore(selectActiveSeason);
  const seasons = useAppStore(s => s.data.seasons);
  const entries = useAppStore(s => s.data.entries);
  const { bilan } = useBilan();

  const evolution = useMemo<EvolutionPoint[]>(
    () =>
      [...seasons]
        .sort((a, b) => (a.label < b.label ? -1 : 1))
        .map(s => ({ label: s.label, ...seasonTotals(s, entries) })),
    [seasons, entries]
  );

  const recettes = toSegments(bilan.recettes);
  const depenses = toSegments(bilan.depenses);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-[var(--uwh-text-soft)]">
        Synthèse visuelle de la saison <strong>{season.label}</strong> et
        évolution sur {seasons.length} saisons. Les écritures compensées sont
        exclues des répartitions.
      </p>

      <Card>
        <div className="mb-3 flex items-center gap-2 text-[var(--uwh-credit)]">
          <ArrowUpRight size={16} aria-hidden="true" />
          <h3 className="font-display font-bold">Répartition des recettes</h3>
        </div>
        <DonutChart
          data={recettes}
          ariaLabel="Répartition des recettes par catégorie"
        />
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2 text-[var(--uwh-debit)]">
          <ArrowDownRight size={16} aria-hidden="true" />
          <h3 className="font-display font-bold">Répartition des dépenses</h3>
        </div>
        <DonutChart
          data={depenses}
          ariaLabel="Répartition des dépenses par catégorie"
        />
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2 text-primary">
          <LineChart size={16} aria-hidden="true" />
          <h3 className="font-display font-bold">Évolution multi-saisons</h3>
        </div>
        <EvolutionChart data={evolution} />
      </Card>
    </div>
  );
}
