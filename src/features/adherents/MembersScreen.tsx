import { useMemo, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { type Adherent, type MemberRole } from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '@mister-guiiug/dev-wpa-config/react/empty-state';
import { VirtualList } from '../../shared/components/VirtualList.tsx';
import { expiryStatus, worstExpiry } from '../../shared/lib/expiry.ts';
import { MemberSheet } from './MemberSheet.tsx';

/** Pastilles d'alerte d'un membre : cotisation due + échéances licence/CM. */
function MemberBadges({ a }: { a: Adherent }) {
  const { t } = useI18n();
  const exp = worstExpiry(
    expiryStatus(a.licenceExpiry),
    expiryStatus(a.medicalCertExpiry)
  );
  if (a.paid && exp !== 'expired' && exp !== 'soon') return null;
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {!a.paid && <Badge tone="warn">{t('adherents.members.dueBadge')}</Badge>}
      {exp === 'expired' && (
        <Badge tone="debit">{t('adherents.members.expiredBadge')}</Badge>
      )}
      {exp === 'soon' && (
        <Badge tone="warn">{t('adherents.members.renewBadge')}</Badge>
      )}
    </div>
  );
}

/**
 * Registre des personnes du club (espace Adhérents). Réutilisé pour « Membres »
 * (tous) et « Encadrement » (filtré sur le rôle encadrant) via `roleFilter`.
 */
export function MembersScreen({ roleFilter }: { roleFilter?: MemberRole }) {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.adherents);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Adherent | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter(a => a.seasonId === season.id)
      .filter(a => !roleFilter || (a.roles ?? []).includes(roleFilter))
      .filter(
        a => !q || `${a.firstName} ${a.lastName}`.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          'fr'
        )
      );
  }, [all, season.id, roleFilter, query]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {roleFilter === 'encadrant'
            ? t('adherents.members.countCoaches', { n: rows.length })
            : t('adherents.members.countMembers', { n: rows.length })}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <UserPlus size={18} aria-hidden="true" />{' '}
          {t('adherents.members.addButton')}
        </Button>
      </div>

      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--uwh-text-soft)]"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('adherents.members.searchPlaceholder')}
          aria-label={t('adherents.members.searchAria')}
          className="min-h-10 w-full rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] pl-9 pr-3 text-sm"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users size={28} aria-hidden="true" />}
          title={
            roleFilter === 'encadrant'
              ? t('adherents.members.emptyCoaches')
              : t('adherents.members.emptyMembers')
          }
          description={t('adherents.members.emptyHint', {
            season: season.label,
          })}
        />
      ) : (
        <VirtualList
          items={rows}
          getKey={a => a.id}
          estimateRowHeight={62}
          ariaLabel={
            roleFilter === 'encadrant'
              ? t('adherents.members.listCoaches')
              : t('adherents.members.listMembers')
          }
        >
          {a => (
            <button
              onClick={() => setEditing(a)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {a.firstName} {a.lastName}
                  {a.status === 'inactif' && (
                    <span className="ml-1 text-xs font-normal text-[var(--uwh-text-soft)]">
                      {t('adherents.members.inactiveTag')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-xs text-[var(--uwh-text-soft)]">
                  <span className="rounded bg-[var(--uwh-surface-2)] px-1.5 py-0.5 font-semibold">
                    {t(`enums.adherentCategory.${a.category}` as TKey)}
                  </span>
                  {(a.roles ?? []).map(r => (
                    <span key={r}>· {t(`enums.memberRole.${r}` as TKey)}</span>
                  ))}
                </p>
              </div>
              <MemberBadges a={a} />
            </button>
          )}
        </VirtualList>
      )}

      {creating && (
        <MemberSheet
          open
          member={null}
          onClose={() => setCreating(false)}
          defaultRole={roleFilter}
        />
      )}
      {editing && (
        <MemberSheet open member={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
