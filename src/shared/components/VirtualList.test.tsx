import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualList } from './VirtualList.tsx';

function renderList(count: number, threshold = 40) {
  const items = Array.from({ length: count }, (_, i) => ({ id: `e${i}`, i }));
  return render(
    <VirtualList
      items={items}
      getKey={item => item.id}
      estimateRowHeight={20}
      threshold={threshold}
      ariaLabel="liste de test"
    >
      {item => <span>Item {item.i}</span>}
    </VirtualList>
  );
}

describe('VirtualList', () => {
  it('petite liste (≤ seuil) : rend tous les éléments', () => {
    renderList(5);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument();
  });

  it('grande liste (> seuil) : ne monte qu’une fenêtre de lignes', () => {
    renderList(500);
    const rendered = screen.getAllByRole('listitem');
    // Bien moins que 500 : seules les lignes proches du viewport sont montées.
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(100);
    // Le haut de la liste est visible ; le fond ne l'est pas.
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.queryByText('Item 499')).not.toBeInTheDocument();
  });

  it('conserve la hauteur totale via des espaceurs (padding)', () => {
    renderList(500);
    const ul = screen.getByRole('list');
    // padBottom non nul → le scroll couvre toute la liste, pas seulement la fenêtre.
    const padBottom = Number.parseFloat(ul.style.paddingBottom || '0');
    expect(padBottom).toBeGreaterThan(0);
  });
});
