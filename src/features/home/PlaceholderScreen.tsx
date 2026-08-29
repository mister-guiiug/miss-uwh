import { Hammer } from 'lucide-react';
import { EmptyState } from '@mister-guiiug/dev-wpa-config/react/empty-state';
import { useI18n } from '../../i18n/index.ts';

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
  const { t } = useI18n();
  return (
    <div className="p-4">
      <EmptyState
        icon={<Hammer size={28} aria-hidden="true" />}
        title={title}
        description={note ?? t('common.comingSoon')}
      />
    </div>
  );
}
