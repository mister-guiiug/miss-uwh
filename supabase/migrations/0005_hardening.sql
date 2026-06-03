-- Miss UWH — 0005 : durcissement serveur.
--   - RPC de clôture/réouverture (le serveur calcule et arbitre, pas le client)
--   - primitive de concurrence optimiste (OCC)
--   - chaînage par hash de l'audit sécurité (inviolabilité)
--   - cohérence sens ↔ catégorie + index sur les écritures actives
--   - publication Realtime

-- ── RPC clôture : le serveur calcule le solde et vérifie le rôle ──────
create or replace function close_season(p_season uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_solde numeric(12,2);
begin
  if not app_can_validate() then
    raise exception 'Droit insuffisant pour clôturer.' using errcode = '42501';
  end if;
  if (select status from seasons where id = p_season) = 'cloturee' then
    raise exception 'Saison déjà clôturée.';
  end if;
  select s.opening_balance
       + coalesce(sum(case when e.sens = 'credit' then e.amount else -e.amount end), 0)
    into v_solde
  from seasons s
  left join entries e
    on e.season_id = s.id and e.deleted_at is null
  where s.id = p_season
  group by s.opening_balance;

  update seasons
     set status = 'cloturee',
         closing_balance = v_solde,
         locked_at = now(),
         locked_by = app_member_id()
   where id = p_season;
end $$;

create or replace function reopen_season(p_season uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app_can_validate() then
    raise exception 'Droit insuffisant pour rouvrir.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Un motif de réouverture est obligatoire.';
  end if;
  update seasons
     set status = 'ouverte', reopened_at = now(), reopen_reason = p_reason
   where id = p_season and status = 'cloturee';
end $$;

-- ── OCC : mise à jour vérifiée par version (primitive, adoptable côté client) ─
-- Rejette si la version connue du client ≠ version serveur (édition concurrente).
create or replace function update_entry_checked(
  p_id uuid, p_expected_version int, p_patch jsonb
) returns int language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  update entries set
    label        = coalesce(p_patch->>'label', label),
    amount       = coalesce((p_patch->>'amount')::numeric, amount),
    category_code= coalesce(p_patch->>'category_code', category_code),
    date         = coalesce((p_patch->>'date')::date, date),
    observation  = coalesce(p_patch->>'observation', observation),
    reconciled   = coalesce((p_patch->>'reconciled')::boolean, reconciled),
    deleted_at   = case when p_patch ? 'deleted_at'
                        then (p_patch->>'deleted_at')::timestamptz else deleted_at end
  where id = p_id and version = p_expected_version
  returning version into v_new;

  if v_new is null then
    raise exception 'Conflit de version sur l''écriture % (rechargez).', p_id
      using errcode = 'serialization_failure';
  end if;
  return v_new;
end $$;

-- ── Audit sécurité inviolable : chaînage par hash (tamper-evidence) ──
alter table audit_securite
  add column if not exists prev_hash text,
  add column if not exists hash text;

create or replace function chain_audit_securite()
returns trigger language plpgsql security definer set search_path = public as $$
declare last_hash text;
begin
  select hash into last_hash from audit_securite order by id desc limit 1;
  new.prev_hash := last_hash;
  new.hash := encode(
    digest(
      coalesce(last_hash, '') || coalesce(new.ts::text, '') || new.action
        || coalesce(new.target_id, '') || new.summary,
      'sha256'
    ), 'hex');
  return new;
end $$;

drop trigger if exists audit_securite_chain on audit_securite;
create trigger audit_securite_chain
  before insert on audit_securite
  for each row execute function chain_audit_securite();

-- ── Cohérence sens ↔ catégorie (une recette est au crédit, etc.) ─────
create or replace function enforce_entry_sens()
returns trigger language plpgsql set search_path = public as $$
declare cat_sens category_sens;
begin
  select sens into cat_sens from categories where code = new.category_code;
  if (cat_sens = 'recette' and new.sens <> 'credit')
     or (cat_sens = 'depense' and new.sens <> 'debit') then
    raise exception 'Sens % incohérent avec la catégorie % (%).',
      new.sens, new.category_code, cat_sens using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists entries_sens_guard on entries;
create trigger entries_sens_guard
  before insert or update on entries
  for each row execute function enforce_entry_sens();

create index if not exists entries_active_idx
  on entries (season_id) where deleted_at is null;

-- ── Realtime : suivre les changements en direct (plusieurs trésoriers) ─
do $$
begin
  alter publication supabase_realtime add table entries;
  alter publication supabase_realtime add table seasons;
  alter publication supabase_realtime add table events;
exception when others then null; -- déjà présentes / publication absente
end $$;
