import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DonutChart } from './DonutChart.tsx';

describe('DonutChart', () => {
  it('rend le SVG et une table accessible (1 ligne / segment)', () => {
    render(
      <DonutChart
        ariaLabel="Recettes"
        data={[
          { label: 'Inscriptions', value: 75, color: '#000' },
          { label: 'Subventions', value: 25, color: '#111' },
        ]}
      />
    );
    expect(screen.getByRole('img', { name: 'Recettes' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    // en-tête + 2 segments
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Inscriptions')).toBeInTheDocument();
  });

  it('affiche un message quand il n’y a pas de données', () => {
    render(<DonutChart ariaLabel="x" data={[]} />);
    expect(screen.getByText(/Aucune donnée/)).toBeInTheDocument();
  });
});
