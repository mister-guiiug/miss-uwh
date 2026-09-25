-- Miss UWH — 0020 : `update_entry_checked` passe enfin par la RLS.
--
-- LE DÉFAUT CORRIGÉ. Créée en 0005 en `security definer`, la fonction
-- s'exécutait avec les droits de son propriétaire : son `update` contournait
-- les politiques `entries_update` (0002), et rien dans son corps ne vérifiait
-- le rôle de l'appelant. Aucun `revoke` non plus : `authenticated` ET `anon`
-- pouvaient l'appeler par `POST /rest/v1/rpc/update_entry_checked`. Un simple
-- membre, qui LIT légitimement les identifiants et les versions de son club,
-- pouvait donc modifier le libellé, le montant, la date ou la suppression
-- logique de n'importe quelle écriture. Aucun client ne l'appelait encore :
-- c'est la préparation de son adoption qui l'a fait relire, le 25/09/2026.
--
-- LE REMÈDE : `security invoker`. L'`update` subit alors les politiques
-- d'`entries`, USING comme WITH CHECK, exactement comme une écriture directe.
-- Le trésorier écrit tout ; le responsable matériel, seulement D4/R7 et sans
-- pouvoir en sortir ; le simple membre, rien. Les triggers de version, d'audit
-- et de verrou de clôture continuent de s'appliquer.
--
-- TROIS ISSUES, DISTINGUÉES SANS COURSE. La ligne est d'abord lue
-- `for update` : sous RLS, cette lecture applique les politiques de SELECT et
-- d'UPDATE, donc une écriture invisible ou hors des droits de l'appelant ne
-- revient pas (42501). Une fois la ligne verrouillée, la comparaison des
-- versions ne peut plus être dépassée par un autre écrivain : l'écart est un
-- vrai conflit (40001, le code que 0005 renvoyait déjà), pas une lecture
-- périmée.
--
-- Signature, sémantique du `p_patch` et valeur de retour inchangées.

create or replace function update_entry_checked(
  p_id uuid, p_expected_version int, p_patch jsonb
) returns int language plpgsql security invoker set search_path = public as $$
declare
  v_current int;
  v_new int;
begin
  select version into v_current from entries where id = p_id for update;
  if not found then
    raise exception 'Écriture % introuvable, ou droits insuffisants pour la modifier.', p_id
      using errcode = 'insufficient_privilege';
  end if;

  if v_current <> p_expected_version then
    raise exception 'Conflit de version sur l''écriture % (rechargez).', p_id
      using errcode = 'serialization_failure';
  end if;

  update entries set
    label        = coalesce(p_patch->>'label', label),
    amount       = coalesce((p_patch->>'amount')::numeric, amount),
    category_code= coalesce(p_patch->>'category_code', category_code),
    date         = coalesce((p_patch->>'date')::date, date),
    observation  = coalesce(p_patch->>'observation', observation),
    reconciled   = coalesce((p_patch->>'reconciled')::boolean, reconciled),
    deleted_at   = case when p_patch ? 'deleted_at'
                        then (p_patch->>'deleted_at')::timestamptz else deleted_at end
  where id = p_id
  returning version into v_new;

  return v_new;
end $$;

-- Rien à faire pour un visiteur : la fonction n'a de sens qu'avec une session.
revoke execute on function update_entry_checked(uuid, int, jsonb) from public, anon;
grant execute on function update_entry_checked(uuid, int, jsonb) to authenticated;
