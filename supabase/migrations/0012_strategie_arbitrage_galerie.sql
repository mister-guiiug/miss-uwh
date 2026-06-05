-- Miss UWH — 0012 : Stratégie + Arbitrage (lens Entraînements) + Galerie
-- (lens Vie du club). Réutilise log_named_audit (0011). Cascade saison. Idempotent.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'strategy_phase') then
    create type strategy_phase as enum
      ('attaque', 'defense', 'transition', 'specifique');
  end if;
end $$;

create table if not exists strategies (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons (id) on delete cascade,
  name        text not null,
  phase       strategy_phase not null default 'attaque',
  description text,
  diagram_url text,
  created_at  timestamptz not null default now()
);
create index if not exists strategies_season_idx on strategies (season_id);

create table if not exists referees (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons (id) on delete cascade,
  name           text not null,
  level          text,
  certifications text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists referees_season_idx on referees (season_id);

create table if not exists photo_albums (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons (id) on delete cascade,
  title      text not null,
  url        text not null,
  date       date,
  cover_url  text,
  created_at timestamptz not null default now()
);
create index if not exists photo_albums_season_idx on photo_albums (season_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table strategies enable row level security;
alter table strategies force row level security;
alter table referees enable row level security;
alter table referees force row level security;
alter table photo_albums enable row level security;
alter table photo_albums force row level security;

-- Stratégies + arbitres : écriture trésorerie / entraîneur / président.
drop policy if exists strategies_read on strategies;
create policy strategies_read on strategies for select to authenticated
  using (app_can_read());
drop policy if exists strategies_write on strategies;
create policy strategies_write on strategies for all to authenticated
  using (app_can_write_accounting() or app_has_role('entraineur') or app_has_role('president'))
  with check (app_can_write_accounting() or app_has_role('entraineur') or app_has_role('president'));

drop policy if exists referees_read on referees;
create policy referees_read on referees for select to authenticated
  using (app_can_read());
drop policy if exists referees_write on referees;
create policy referees_write on referees for all to authenticated
  using (app_can_write_accounting() or app_has_role('entraineur') or app_has_role('president'))
  with check (app_can_write_accounting() or app_has_role('entraineur') or app_has_role('president'));

-- Albums : écriture trésorerie / resp. événement / président.
drop policy if exists photo_albums_read on photo_albums;
create policy photo_albums_read on photo_albums for select to authenticated
  using (app_can_read());
drop policy if exists photo_albums_write on photo_albums;
create policy photo_albums_write on photo_albums for all to authenticated
  using (app_can_write_accounting() or app_has_role('resp_evenement') or app_has_role('president'))
  with check (app_can_write_accounting() or app_has_role('resp_evenement') or app_has_role('president'));

-- ── Audit (réutilise log_named_audit de 0011) ────────────────────────
drop trigger if exists strategies_audit on strategies;
create trigger strategies_audit after insert or update or delete on strategies
  for each row execute function log_named_audit('strategy', 'name');

drop trigger if exists referees_audit on referees;
create trigger referees_audit after insert or update or delete on referees
  for each row execute function log_named_audit('referee', 'name');

drop trigger if exists photo_albums_audit on photo_albums;
create trigger photo_albums_audit after insert or update or delete on photo_albums
  for each row execute function log_named_audit('album', 'title');

-- ── Realtime ─────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table strategies; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table referees; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table photo_albums; exception when others then null; end $$;
