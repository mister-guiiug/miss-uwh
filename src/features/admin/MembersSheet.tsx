import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase.ts';
import type { Role } from '../../auth/useAuth.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Badge } from '../../shared/components/badges.tsx';

interface MemberRow {
  id: string;
  email: string;
  display_name: string | null;
  roles: Role[];
  active: boolean;
}

const ROLES: { key: Role; label: string }[] = [
  { key: 'admin_technique', label: 'Admin' },
  { key: 'tresorier', label: 'Trésorier' },
  { key: 'tresorier_adjoint', label: 'Trésorier adjoint' },
  { key: 'president', label: 'Président' },
  { key: 'resp_evenement', label: 'Resp. événement' },
  { key: 'resp_materiel', label: 'Resp. matériel' },
  { key: 'controleur', label: 'Contrôleur' },
  { key: 'membre', label: 'Membre' },
];

/**
 * Administration des membres et de leurs rôles (mode Supabase, rôle admin).
 * Les écritures sont arbitrées par la RLS `members_admin` côté serveur.
 */
export function MembersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(undefined);
      const { data, error } = await getSupabase()
        .from('members')
        .select('id,email,display_name,roles,active')
        .order('email');
      if (cancelled) return;
      if (error) setError(error.message);
      else setMembers((data as MemberRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function toggleRole(m: MemberRow, role: Role) {
    const roles = m.roles.includes(role)
      ? m.roles.filter(r => r !== role)
      : [...m.roles, role];
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, roles } : x)));
    const { error } = await getSupabase()
      .from('members')
      .update({ roles })
      .eq('id', m.id);
    if (error) setError(error.message);
  }

  async function toggleActive(m: MemberRow) {
    const active = !m.active;
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, active } : x)));
    const { error } = await getSupabase()
      .from('members')
      .update({ active })
      .eq('id', m.id);
    if (error) setError(error.message);
  }

  return (
    <Sheet open={open} title="Membres & rôles" onClose={onClose}>
      {error && (
        <p role="alert" className="mb-3 text-sm text-[var(--uwh-debit)]">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-[var(--uwh-text-soft)]">Chargement…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--uwh-text-soft)]">
          Aucun membre (ou accès refusé par la RLS).
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {members.map(m => (
            <li
              key={m.id}
              className="rounded-2xl border border-[var(--uwh-border)] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {m.display_name || m.email}
                  </p>
                  <p className="truncate text-xs text-[var(--uwh-text-soft)]">
                    {m.email}
                  </p>
                </div>
                <button
                  onClick={() => void toggleActive(m)}
                  aria-pressed={m.active}
                >
                  <Badge tone={m.active ? 'credit' : 'neutral'}>
                    {m.active ? 'actif' : 'inactif'}
                  </Badge>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map(r => {
                  const on = m.roles.includes(r.key);
                  return (
                    <button
                      key={r.key}
                      onClick={() => void toggleRole(m, r.key)}
                      aria-pressed={on}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on
                          ? 'bg-primary text-white'
                          : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
