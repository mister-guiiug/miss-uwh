-- Miss UWH — 0021 : `update_entry_checked` couvre tout ce que le client modifie.
--
-- POURQUOI. Depuis le 25/09/2026, toute MODIFICATION d'une écriture existante
-- part du client par cette fonction, avec la version qu'il a vue — les
-- créations restent des upserts. Or 0005 ne savait écrire que sept colonnes :
-- `label`, `amount`, `category_code`, `date`, `observation`, `reconciled` et
-- `deleted_at`. Le formulaire d'écriture en modifie six de plus : `sens`,
-- `method`, `piece_ref`, `invoice_code`, `event_id` et `components`. Sans eux,
-- changer une recette en dépense échouait (le déclencheur `entries_sens_guard`
-- de 0005 refuse une catégorie de dépense au crédit), et un changement de mode
-- de règlement, de pièce ou d'événement se perdait sans un mot.
--
-- DEUX SÉMANTIQUES, SELON LA COLONNE.
--   - Colonne NOT NULL (`label`, `amount`, `category_code`, `date`, `sens`,
--     `method`, `reconciled`) : une clé absente ou nulle laisse la valeur en
--     place — c'était déjà la règle de 0005, reconduite telle quelle.
--   - Colonne facultative (`observation`, `piece_ref`, `invoice_code`,
--     `event_id`, `components`, `deleted_at`) : une clé PRÉSENTE s'applique,
--     `null` compris. C'est la règle que 0005 réservait à `deleted_at` ; elle
--     vaut maintenant pour toutes, parce que vider un champ est une
--     modification comme une autre. `observation` change donc de sens : avec
--     `coalesce`, on ne pouvait pas l'effacer. Aucun client n'appelait la
--     fonction avant ce jour : le changement ne casse rien.
--   `components` est un objet JSON : `null` (JSON) devient NULL (SQL), pour
--   qu'un `components is null` dise vrai.
--
-- `season_id` N'EST PAS DANS LA LISTE, exprès : le client ne déplace jamais une
-- écriture d'une saison à l'autre (on ne modifie une écriture que depuis le
-- journal de sa saison), et `enforce_season_lock` (0001) ne vérifie, sur un
-- UPDATE, que la saison d'ARRIVÉE — ouvrir ce chemin ici permettrait de sortir
-- une écriture d'une saison clôturée.
--
-- INCHANGÉ : signature, valeur de retour, `security invoker` (0020 : l'update
-- subit la RLS d'`entries`, USING comme WITH CHECK), lecture `for update`,
-- 42501 pour une ligne invisible ou hors droits, 40001 pour une version
-- périmée, droits d'exécution. Rejouable : `create or replace` puis les mêmes
-- `revoke`/`grant` que 0020.

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
    -- NOT NULL : absente ou nulle, la clé laisse la valeur en place.
    label         = coalesce(p_patch->>'label', label),
    amount        = coalesce((p_patch->>'amount')::numeric, amount),
    category_code = coalesce(p_patch->>'category_code', category_code),
    date          = coalesce((p_patch->>'date')::date, date),
    sens          = coalesce((p_patch->>'sens')::entry_sens, sens),
    method        = coalesce(p_patch->>'method', method),
    reconciled    = coalesce((p_patch->>'reconciled')::boolean, reconciled),
    -- Facultatives : présente, la clé s'applique, `null` compris.
    observation   = case when p_patch ? 'observation'
                         then p_patch->>'observation' else observation end,
    piece_ref     = case when p_patch ? 'piece_ref'
                         then p_patch->>'piece_ref' else piece_ref end,
    invoice_code  = case when p_patch ? 'invoice_code'
                         then p_patch->>'invoice_code' else invoice_code end,
    event_id      = case when p_patch ? 'event_id'
                         then (p_patch->>'event_id')::uuid else event_id end,
    components    = case when p_patch ? 'components'
                         then nullif(p_patch->'components', 'null'::jsonb)
                         else components end,
    deleted_at    = case when p_patch ? 'deleted_at'
                         then (p_patch->>'deleted_at')::timestamptz else deleted_at end
  where id = p_id
  returning version into v_new;

  return v_new;
end $$;

-- Mêmes droits qu'en 0020 : rien pour un visiteur, une session suffit.
revoke execute on function update_entry_checked(uuid, int, jsonb) from public, anon;
grant execute on function update_entry_checked(uuid, int, jsonb) to authenticated;
