import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { getSupabase } from '../../lib/supabase.ts';
import type { Role } from '../../auth/useAuth.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '@mister-guiiug/dev-pwa-config/react/empty-state';

interface MemberRow {
  id: string;
  email: string;
  display_name: string | null;
  roles: Role[];
  active: boolean;
}

const ROLES: Role[] = [
  'admin_technique',
  'tresorier',
  'tresorier_adjoint',
  'president',
  'secretaire',
  'entraineur',
  'resp_evenement',
  'resp_materiel',
  'controleur',
  'membre',
];

/**
 * Écran d'administration des membres et de leurs rôles (mode Supabase, rôle
 * admin). Les écritures sont arbitrées par la RLS `members_admin` côté serveur.
 */
export function MembersRolesScreen() {
  const { t } = useI18n();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  /**
   * LE SEUL ÉCRAN DE L'APP OÙ L'IHM MENT QUAND LE RÉSEAU MANQUE.
   *
   * Partout ailleurs, une écriture part dans la file du socle : elle est
   * conservée, rejouée à la reconnexion, et le bandeau la compte. Ici, non.
   * `toggleRole` et `toggleActive` peignent d'abord l'état localement
   * (`setMembers`), écrivent ensuite EN DIRECT dans `members`, et en cas
   * d'échec se contentent d'un `setError` — sans jamais défaire la peinture.
   * Hors connexion, la pastille de rôle reste donc visiblement activée alors
   * que RIEN n'a été écrit ; elle redeviendra grise au prochain chargement,
   * bien plus tard, sans que personne ne fasse le lien. Un administrateur
   * repart convaincu d'avoir nommé un trésorier qui ne l'est pas.
   *
   * Le garde refuse AVANT de peindre : pas de peinture, pas de mensonge.
   * `aria-disabled` plutôt que `disabled` — la pastille reste focusable, donc
   * le motif reste découvrable au clavier — et `wrap()` rend l'action inerte.
   */
  const guard = useActionGuard({ online: true });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(undefined);
      const sb = await getSupabase();
      const { data, error } = await sb
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
  }, []);

  async function toggleRole(m: MemberRow, role: Role) {
    const roles = m.roles.includes(role)
      ? m.roles.filter(r => r !== role)
      : [...m.roles, role];
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, roles } : x)));
    const sb = await getSupabase();
    const { error } = await sb.from('members').update({ roles }).eq('id', m.id);
    if (error) setError(error.message);
  }

  async function toggleActive(m: MemberRow) {
    const active = !m.active;
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, active } : x)));
    const sb = await getSupabase();
    const { error } = await sb
      .from('members')
      .update({ active })
      .eq('id', m.id);
    if (error) setError(error.message);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-[var(--uwh-text-soft)]">
        {t('adherents.roles.intro')}
      </p>

      {error && (
        <p role="alert" className="text-sm text-[var(--uwh-debit)]">
          {error}
        </p>
      )}

      {/* Le motif, écrit une fois pour tout l'écran : il vaut pour chaque
          pastille de rôle comme pour chaque bascule d'activation. Le répéter
          sur les dizaines de pastilles en ferait du bruit. */}
      {guard.reason && (
        <p role="status" className="text-sm text-[var(--uwh-warn)]">
          {guard.reason}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--uwh-text-soft)]">
          {t('common.loading')}
        </p>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users size={28} aria-hidden="true" />}
          title={t('adherents.roles.emptyTitle')}
          description={t('adherents.roles.emptyHint')}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {members.map(m => (
            <li
              key={m.id}
              className="rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3"
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
                  onClick={guard.wrap(() => void toggleActive(m))}
                  {...guard.disabledProps}
                  title={guard.reason ?? undefined}
                  className={guard.disabled ? 'opacity-45' : undefined}
                  aria-pressed={m.active}
                  aria-label={
                    m.active
                      ? t('adherents.roles.deactivateAccount')
                      : t('adherents.roles.activateAccount')
                  }
                >
                  <Badge tone={m.active ? 'credit' : 'neutral'}>
                    {m.active
                      ? t('adherents.roles.active')
                      : t('adherents.roles.inactive')}
                  </Badge>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map(r => {
                  const on = m.roles.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={guard.wrap(() => void toggleRole(m, r))}
                      {...guard.disabledProps}
                      title={guard.reason ?? undefined}
                      aria-pressed={on}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on
                          ? 'bg-primary text-white'
                          : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
                      }${guard.disabled ? ' opacity-45' : ''}`}
                    >
                      {t(`adherents.roles.${r}` as TKey)}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
