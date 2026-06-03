import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EvolutionChart } from './EvolutionChart.tsx';

describe('EvolutionChart', () => {
  it('rend le graphe et une table accessible par saison', () => {
    render(
      <EvolutionChart
        data={[
          { label: '2023-2024', recettes: 100, depenses: 80, solde: 20 },
          { label: '2024-2025', recettes: 120, depenses: 90, solde: 30 },
        ]}
      />
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3); // en-tête + 2 saisons
    expect(within(table).getByText('2024-2025')).toBeInTheDocument();
  });

  it('message si pas d’historique', () => {
    render(<EvolutionChart data={[]} />);
    expect(screen.getByText(/Pas encore d'historique/)).toBeInTheDocument();
  });
});
