import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import type { Adherent } from '../../shared/types/domain.ts';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { FamilleSheet } from './FamilleSheet.tsx';

/** Familles / tuteurs : choisir un membre pour gérer ses parents/contacts. */
export function FamillesScreen() {
  const season = useAppStore(selectActiveSeason);
  const members = useAppStore(s => s.data.adherents);
  const guardians = useAppStore(s => s.data.guardians);
  const [query, setQuery] = useState('');
  const [openMember, setOpenMember] = useState<Adherent | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter(a => a.seasonId === season.id)
      .filter(
        a => !q || `${a.firstName} ${a.lastName}`.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          'fr'
        )
      );
  }, [members, season.id, query]);

  const countFor = (id: string) =>
    guardians.filter(g => g.memberId === id).length;

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--uwh-text-soft)]">
        Parents, tuteurs et contacts d'urgence. Sélectionnez un membre pour
        gérer sa famille.
      </p>
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--uwh-text-soft)]"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un membre…"
          aria-label="Rechercher un membre"
          className="min-h-10 w-full rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] pl-9 pr-3 text-sm"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState Icon={Users} title="Aucun membre">
          Ajoutez d'abord des membres dans l'onglet Membres.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(a => {
            const n = countFor(a.id);
            return (
              <li key={a.id}>
                <button
                  onClick={() => setOpenMember(a)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {a.firstName} {a.lastName}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--uwh-text-soft)]">
                    {n === 0
                      ? 'aucun contact'
                      : `${n} contact${n > 1 ? 's' : ''}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openMember && (
        <FamilleSheet
          open
          member={openMember}
          onClose={() => setOpenMember(null)}
        />
      )}
    </div>
  );
}
