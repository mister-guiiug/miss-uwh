-- Miss UWH — Schéma relationnel (PostgreSQL / Supabase)
-- Bilan comptable saisonnier d'un club de Hockey Subaquatique.
-- Sécurité appliquée côté serveur : RLS (0002), audit séparé, verrouillage de
-- clôture. Le bundle public (GitHub Pages) ne porte JAMAIS de règle d'accès.

create extension if not exists pgcrypto;

-- ── Club & membres ───────────────────────────────────────────────────
create table if not exists clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  affiliation  text,
  created_at   timestamptz not null default now()
);

-- Rôles applicatifs (RBAC). Un membre peut cumuler plusieurs rôles.
create type app_role as enum (
  'admin_technique',
  'tresorier',
  'tresorier_adjoint',
  'president',
  'resp_evenement',
  'resp_materiel',
  'controleur',
  'membre'
);

create table if not exists members (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid unique references auth.users (id) on delete set null,
  club_id       uuid not null references clubs (id) on delete cascade,
  email         text not null,
  display_name  text,
  roles         app_role[] not null default array['membre']::app_role[],
  -- MFA imposée pour les rôles sensibles (vérifiée aussi par Supabase Auth AAL2).
  mfa_required  boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Référentiel des catégories ───────────────────────────────────────
create type entry_sens as enum ('credit', 'debit');
create type category_sens as enum ('recette', 'depense');
create type category_kind as enum (
  'exploitation', 'compensee', 'regularisation', 'transfert'
);

create table if not exists categories (
  code        text primary key,        -- R1..R9, D1..D13, R-COMP, ...
  label       text not null,
  sens        category_sens not null,
  kind        category_kind not null default 'exploitation',
  components  text[]
);

-- ── Saisons ──────────────────────────────────────────────────────────
create type season_status as enum ('ouverte', 'cloturee');

create table if not exists seasons (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references clubs (id) on delete cascade,
  label            text not null,
  start_date       date not null,
  end_date         date not null,
  status           season_status not null default 'ouverte',
  opening_balance  numeric(12,2) not null default 0,
  closing_balance  numeric(12,2),
  locked_at        timestamptz,
  locked_by        uuid references members (id),
  reopened_at      timestamptz,
  reopen_reason    text,
  unique (club_id, label)
);

-- ── Événements (TDA, CDF, buvette, stage…) ───────────────────────────
create type event_kind as enum ('tournoi', 'buvette', 'stage', 'autre');

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons (id) on delete cascade,
  name       text not null,
  kind       event_kind not null default 'autre'
);

-- ── Écritures du journal ─────────────────────────────────────────────
create table if not exists entries (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons (id) on delete restrict,
  category_code text not null references categories (code),
  date          date not null,
  label         text not null,
  sens          entry_sens not null,
  amount        numeric(12,2) not null check (amount > 0), -- règle 3
  method        text not null default 'autre',
  piece_ref     text,
  invoice_code  text,
  observation   text,
  event_id      uuid references events (id) on delete set null,
  components    jsonb,
  created_at    timestamptz not null default now(),
  created_by    uuid references members (id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references members (id),
  deleted_at    timestamptz,                -- suppression LOGIQUE (règle 14)
  deleted_by    uuid references members (id),
  version       integer not null default 1  -- historisation (règle 13)
);
create index if not exists entries_season_idx on entries (season_id);
create index if not exists entries_category_idx on entries (category_code);
create index if not exists entries_event_idx on entries (event_id);

-- ── Pièces justificatives (métadonnées ; binaire dans Storage privé) ─
create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references entries (id) on delete cascade,
  name         text not null,
  mime         text,
  size         integer,
  storage_path text not null,   -- chemin dans le bucket privé `justificatifs`
  uploaded_at  timestamptz not null default now(),
  uploaded_by  uuid references members (id)
);

-- ── Audit : logs MÉTIER et SÉCURITÉ séparés (append-only) ────────────
create table if not exists audit_metier (
  id          bigint generated by default as identity primary key,
  ts          timestamptz not null default now(),
  actor       uuid references members (id),
  actor_email text,
  action      text not null,
  target_type text not null,
  target_id   text,
  summary     text not null,
  before      jsonb,
  after       jsonb
);

create table if not exists audit_securite (
  id          bigint generated by default as identity primary key,
  ts          timestamptz not null default now(),
  actor       uuid references members (id),
  actor_email text,
  action      text not null,        -- auth.signin, season.close, entry.delete…
  target_type text not null,
  target_id   text,
  summary     text not null,
  ip          inet,
  user_agent  text
);

-- ── Verrouillage de clôture (défense en profondeur, en plus de la RLS) ─
create or replace function enforce_season_lock()
returns trigger language plpgsql as $$
declare
  sid uuid := coalesce(new.season_id, old.season_id);
  st  season_status;
begin
  select status into st from seasons where id = sid;
  if st = 'cloturee' then
    raise exception 'Saison clôturée : écriture verrouillée (%).', sid
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

create trigger entries_lock_guard
  before insert or update or delete on entries
  for each row execute function enforce_season_lock();

-- Incrément automatique de version + horodatage à chaque modification.
create or replace function bump_entry_version()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
  return new;
end $$;

create trigger entries_version_bump
  before update on entries
  for each row execute function bump_entry_version();
