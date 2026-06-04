import { Hammer } from 'lucide-react';
import { EmptyState } from '../../shared/components/EmptyState.tsx';

/**
 * Écran d'attente pour les menus des lens non encore implémentés (scaffolding
 * du Lot 0). Le menu/route existe ; le contenu arrive dans un lot ultérieur.
 */
export function PlaceholderScreen({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="p-4">
      <EmptyState Icon={Hammer} title={title}>
        {note ?? 'Cet écran arrive dans un prochain lot.'}
      </EmptyState>
    </div>
  );
}
