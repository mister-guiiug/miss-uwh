-- Miss UWH — 0006 : synchronisation serveur des registres auxiliaires.
--   Jusqu'ici LOCAUX (localStorage uniquement, non partagés) :
--     - récurrences (modèles d'écriture)
--     - adhérents (registre des inscriptions)
--     - catégories personnalisées (C1, C2…)
--   Désormais persistés côté serveur, partagés entre appareils/trésoriers,
--   arbitrés par RLS, audités (métier) et suivis en Realtime.
--   Migration IDEMPOTENTE (ré-applicable sans erreur).

-- ── Catégories personnalisées : drapeau `custom` dans la table existante ──
-- Les écritures référencent categories.code (FK) : les codes perso C1, C2…
-- DOIVENT donc vivre dans cette table pour qu'une écriture puisse les viser.
alter table categories
  add column if not exists custom boolean not null default false;

-- Trésorerie : gère UNIQUEMENT les catégories personnalisées (custom = true).
-- La taxonomie fixe (custom = false) reste réservée à l'admin (policy 0002).
drop policy if exists categories_custom_write on categories;
create policy categories_custom_write on categories for all to authenticated
  using (custom and app_can_write_accounting())
  with check (custom and app_can_write_accounting());

-- ── Récurrences (modèles d'écriture rapides) ─────────────────────────
create table if not exists recurrings (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs (id) on delete cascade,
  label         text not null,
  category_code text not null references categories (code),
  amount        numeric(12,2) not null check (amount > 0),
  method        text not null default 'autre',
  created_at    timestamptz not null default now()
);
create index if not exists recurrings_club_idx on recurrings (club_id);

-- ── Adhérents (registre des inscriptions, par saison) ────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'adherent_category') then
    create type adherent_category as enum
      ('adulte', 'adulte_reduit', 'jeune', 'enfant');
  end if;
end $$;

create table if not exists adherents (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons (id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  category       adherent_category not null default 'adulte',
  licence_number text,
  amount         numeric(12,2) not null default 0 check (amount >= 0),
  paid           boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists adherents_season_idx on adherents (season_id);

-- ── RLS : lecture tout membre actif, écriture trésorerie ─────────────
alter table recurrings enable row level security;
alter table recurrings force row level security;
alter table adherents  enable row level security;
alter table adherents  force row level security;

drop policy if exists recurrings_read on recurrings;
create policy recurrings_read on recurrings for select to authenticated
  using (app_can_read());
drop policy if exists recurrings_write on recurrings;
create policy recurrings_write on recurrings for all to authenticated
  using (app_can_write_accounting()) with check (app_can_write_accounting());

drop policy if exists adherents_read on adherents;
create policy adherents_read on adherents for select to authenticated
  using (app_can_read());
drop policy if exists adherents_write on adherents;
create policy adherents_write on adherents for all to authenticated
  using (app_can_write_accounting()) with check (app_can_write_accounting());

-- ── Audit métier serveur (adhérents + catégories perso) ──────────────
-- Sans ces déclencheurs, l'audit local de ces mutations serait effacé au pull
-- (le serveur fait foi). On reproduit donc la trace côté serveur.
create or replace function log_adherent_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare act uuid := app_member_id(); mail text := app_member_email();
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, 'adherent.create', 'adherent', new.id::text,
              format('Adhérent « %s %s » ajouté.', new.first_name, new.last_name),
              to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, 'adherent.update', 'adherent', new.id::text,
              format('Adhérent « %s %s » modifié.', new.first_name, new.last_name),
              to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, 'adherent.delete', 'adherent', old.id::text,
              format('Adhérent « %s %s » retiré.', old.first_name, old.last_name),
              to_jsonb(old));
    return old;
  end if;
end $$;

drop trigger if exists adherents_audit on adherents;
create trigger adherents_audit
  after insert or update or delete on adherents
  for each row execute function log_adherent_audit();

create or replace function log_category_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare act uuid := app_member_id(); mail text := app_member_email();
begin
  -- On n'audite QUE les catégories personnalisées (custom = true).
  if not coalesce(new.custom, old.custom, false) then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary)
      values (act, mail, 'category.create', 'category', new.code,
              format('Catégorie personnalisée « %s » (%s).', new.label, new.code));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary)
      values (act, mail, 'category.delete', 'category', old.code,
              format('Catégorie personnalisée « %s » (%s) retirée.', old.label, old.code));
    return old;
  end if;
end $$;

drop trigger if exists categories_audit on categories;
create trigger categories_audit
  after insert or delete on categories
  for each row execute function log_category_audit();

-- ── Realtime : suivre les changements en direct (plusieurs trésoriers) ─
do $$
begin
  alter publication supabase_realtime add table recurrings;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table adherents;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table categories;
exception when others then null;
end $$;
