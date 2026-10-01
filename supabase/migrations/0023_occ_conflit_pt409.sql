-- Miss UWH — 0023 : un conflit de version ne fait plus tourner PostgREST.
--
-- LE DÉFAUT. `update_entry_checked` (0005, puis 0020 et 0021) signalait une
-- version périmée par `40001`, le code de l'échec de sérialisation. PostgREST
-- le prend pour un échec PASSAGER et rejoue la transaction, sans fin : la
-- fonction relève le même conflit à chaque tour, la requête ne répond jamais,
-- et le backend tourne à plein — en reprenant à chaque tour le verrou
-- `for update` de l'écriture — jusqu'à ce qu'on le tue. Supabase le documente
-- (PostgREST 14, corrigé en 16) :
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
--
-- Depuis le 25/09/2026, toute modification d'une écriture passe par cette
-- fonction : deux trésoriers sur la même écriture, ou une file hors ligne
-- rejouée après une modification faite ailleurs, lançaient une boucle à chaque
-- nouvel essai de la file. Les tests pgTAP ne pouvaient pas le voir : ils
-- appellent le SQL sans passer par PostgREST. Le défaut a été trouvé le
-- 01/10/2026 sur mister-molkky, dont `sync_push` levait le même code.
--
-- LE CORRECTIF. Le conflit se signale par `PT409` : PostgREST rend un code
-- `PTxyz` en HTTP xyz, ici 409 Conflict, et ne le rejoue pas. Le client
-- (`src/backend/entryPatch.ts`) reconnaît ce code. Rien d'autre ne change :
-- signature, `security invoker`, lecture `for update`, 42501 pour une ligne
-- invisible ou hors droits, colonnes et sémantiques de 0021.
--
-- LA GARDE. `supabase/tests/structure-securite.test.sql` refuse désormais
-- toute fonction de `public` qui mentionne l'ancien code.
--
-- REJOUABLE : `create or replace` sur la même signature, puis les mêmes
-- `revoke`/`grant` que 0020 et 0021.

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
      using errcode = 'PT409';
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

-- Mêmes droits qu'en 0020 et 0021 : rien pour un visiteur, une session suffit.
revoke execute on function update_entry_checked(uuid, int, jsonb) from public, anon;
grant execute on function update_entry_checked(uuid, int, jsonb) to authenticated;
