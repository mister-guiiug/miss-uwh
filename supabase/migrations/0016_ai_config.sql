-- Miss UWH — 0016 : Config IA COMMUNE du club (« partie fixe pour tous »).
-- Skills/instructions partagés injectés dans la génération d'exercices par IA.
-- Une seule ligne par club (PK = club_id). La clé API personnelle des membres
-- N'EST JAMAIS stockée ici : elle reste locale à leur appareil. Idempotent.

create table if not exists ai_config (
  club_id      uuid primary key references clubs (id) on delete cascade,
  shared_skills text not null default '',
  updated_at   timestamptz not null default now()
);

-- Tient updated_at à jour à chaque écriture.
create or replace function ai_config_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ai_config_touch on ai_config;
create trigger ai_config_touch before insert or update on ai_config
  for each row execute function ai_config_touch();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table ai_config enable row level security;
alter table ai_config force row level security;

-- Lecture : tout membre authentifié et actif du club.
drop policy if exists ai_config_read on ai_config;
create policy ai_config_read on ai_config for select to authenticated
  using (app_can_read());

-- Écriture : trésorerie / entraîneur / président (comme exercices & stratégies).
drop policy if exists ai_config_write on ai_config;
create policy ai_config_write on ai_config for all to authenticated
  using (app_can_write_accounting() or app_has_role('entraineur') or app_has_role('president'))
  with check (app_can_write_accounting() or app_has_role('entraineur') or app_has_role('president'));

-- ── Audit métier (mêmes helpers app_member_* que 0011) ───────────────
create or replace function log_ai_config_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_metier (actor, actor_email, action, target_type, target_id, summary)
  values (
    app_member_id(),
    app_member_email(),
    'aiconfig.' || lower(tg_op),
    'aiconfig',
    coalesce(new.club_id, old.club_id)::text,
    'Mise à jour des instructions IA communes du club.'
  );
  return coalesce(new, old);
end $$;

drop trigger if exists ai_config_audit on ai_config;
create trigger ai_config_audit after insert or update or delete on ai_config
  for each row execute function log_ai_config_audit();

-- ── Realtime ─────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table ai_config; exception when others then null; end $$;
