import { useMemo, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  MEMBER_ROLE_LABELS,
  type Adherent,
  type AdherentCategory,
  type MemberRole,
} from '../../shared/types/domain.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { MemberSheet } from './MemberSheet.tsx';

const CAT_LABELS: Record<AdherentCategory, string> = {
  adulte: 'Adulte',
  adulte_reduit: 'Adulte réduit',
  jeune: 'Jeune',
  enfant: 'Enfant',
};

/**
 * Registre des personnes du club (espace Adhérents). Réutilisé pour « Membres »
 * (tous) et « Encadrement » (filtré sur le rôle encadrant) via `roleFilter`.
 */
export function MembersScreen({ roleFilter }: { roleFilter?: MemberRole }) {
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

  const noun = roleFilter === 'encadrant' ? 'encadrant' : 'membre';

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} {noun}
          {rows.length > 1 ? 's' : ''}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <UserPlus size={18} aria-hidden="true" /> Membre
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
          placeholder="Rechercher un nom…"
          aria-label="Rechercher un membre"
          className="min-h-10 w-full rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] pl-9 pr-3 text-sm"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Users} title={`Aucun ${noun}`}>
          Ajoutez les adhérents de la saison {season.label}.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(a => (
            <li key={a.id}>
              <button
                onClick={() => setEditing(a)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {a.firstName} {a.lastName}
                    {a.status === 'inactif' && (
                      <span className="ml-1 text-xs font-normal text-[var(--uwh-text-soft)]">
                        (inactif)
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-xs text-[var(--uwh-text-soft)]">
                    <span className="rounded bg-[var(--uwh-surface-2)] px-1.5 py-0.5 font-semibold">
                      {CAT_LABELS[a.category]}
                    </span>
                    {(a.roles ?? []).map(r => (
                      <span key={r}>· {MEMBER_ROLE_LABELS[r]}</span>
                    ))}
                  </p>
                </div>
                {!a.paid && (
                  <Badge tone="warn" className="shrink-0">
                    cotisation due
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
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
