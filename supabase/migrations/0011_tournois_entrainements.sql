-- Miss UWH — 0011 : Tournois (Lot B) + Séances & Exercices (Lot C).
-- Tournois : écriture trésorerie / resp. événement / président (espace Vie du
-- club). Séances + Exercices : écriture trésorerie / entraîneur / président
-- (espace Entraînements). Lecture : tout membre. Cascade saison. Idempotent.

-- ── Types ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tournament_status') then
    create type tournament_status as enum ('prevu', 'en_cours', 'termine');
  end if;
  if not exists (select 1 from pg_type where typname = 'exercise_category') then
    create type exercise_category as enum
      ('echauffement', 'technique', 'physique', 'jeu', 'gardien');
  end if;
end $$;

-- ── Tournois ─────────────────────────────────────────────────────────
create table if not exists tournaments (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons (id) on delete cascade,
  name       text not null,
  date       date not null,
  location   text,
  status     tournament_status not null default 'prevu',
  event_id   uuid references events (id) on delete set null,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists tournaments_season_idx on tournaments (season_id);

-- ── Séances d'entraînement ───────────────────────────────────────────
create table if not exists training_sessions (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons (id) on delete cascade,
  date        date not null,
  location    text,
  team_group  text,
  coach_id    uuid references adherents (id) on delete set null,
  focus       text,
  attendance  uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists training_sessions_season_idx
  on training_sessions (season_id);

-- ── Exercices ────────────────────────────────────────────────────────
create table if not exists exercises (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references seasons (id) on delete cascade,
  name         text not null,
  category     exercise_category not null default 'technique',
  description  text,
  duration_min integer,
  level        text,
  created_at   timestamptz not null default now()
);
create index if not exists exercises_season_idx on exercises (season_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table tournaments enable row level security;
alter table tournaments force row level security;
alter table training_sessions enable row level security;
alter table training_sessions force row level security;
alter table exercises enable row level security;
alter table exercises force row level security;

drop policy if exists tournaments_read on tournaments;
create policy tournaments_read on tournaments for select to authenticated
  using (app_can_read());
drop policy if exists tournaments_write on tournaments;
create policy tournaments_write on tournaments for all to authenticated
  using (
    app_can_write_accounting()
    or app_has_role('resp_evenement')
    or app_has_role('president')
  )
  with check (
    app_can_write_accounting()
    or app_has_role('resp_evenement')
    or app_has_role('president')
  );

drop policy if exists training_sessions_read on training_sessions;
create policy training_sessions_read on training_sessions for select to authenticated
  using (app_can_read());
drop policy if exists training_sessions_write on training_sessions;
create policy training_sessions_write on training_sessions for all to authenticated
  using (
    app_can_write_accounting()
    or app_has_role('entraineur')
    or app_has_role('president')
  )
  with check (
    app_can_write_accounting()
    or app_has_role('entraineur')
    or app_has_role('president')
  );

drop policy if exists exercises_read on exercises;
create policy exercises_read on exercises for select to authenticated
  using (app_can_read());
drop policy if exists exercises_write on exercises;
create policy exercises_write on exercises for all to authenticated
  using (
    app_can_write_accounting()
    or app_has_role('entraineur')
    or app_has_role('president')
  )
  with check (
    app_can_write_accounting()
    or app_has_role('entraineur')
    or app_has_role('president')
  );

-- ── Audit métier générique (kind + colonne de libellé via tg_argv) ───
create or replace function log_named_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id(); mail text := app_member_email();
  kind text := tg_argv[0];
  labelcol text := tg_argv[1];
  lbl text := coalesce(to_jsonb(new) ->> labelcol, to_jsonb(old) ->> labelcol, '');
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, kind || '.create', kind, new.id::text,
              format('« %s » créé.', lbl), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, kind || '.update', kind, new.id::text,
              format('« %s » modifié.', lbl), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, kind || '.delete', kind, old.id::text,
              format('« %s » supprimé.', lbl), to_jsonb(old));
    return old;
  end if;
end $$;

drop trigger if exists tournaments_audit on tournaments;
create trigger tournaments_audit after insert or update or delete on tournaments
  for each row execute function log_named_audit('tournament', 'name');

drop trigger if exists training_sessions_audit on training_sessions;
create trigger training_sessions_audit
  after insert or update or delete on training_sessions
  for each row execute function log_named_audit('session', 'date');

drop trigger if exists exercises_audit on exercises;
create trigger exercises_audit after insert or update or delete on exercises
  for each row execute function log_named_audit('exercise', 'name');

-- ── Realtime ─────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table tournaments; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table training_sessions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table exercises; exception when others then null; end $$;
