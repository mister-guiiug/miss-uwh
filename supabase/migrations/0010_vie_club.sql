-- Miss UWH — 0010 : espace « Vie du club » (Lot B). Agenda d'événements + annonces.
-- Distinct des `events` (EventLedger comptable). Lecture : tout membre ; écriture :
-- trésorerie OU resp. événement OU président. Cascade sur la saison. Idempotent.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'club_event_type') then
    create type club_event_type as enum
      ('reunion', 'sortie', 'ag', 'soiree', 'competition', 'autre');
  end if;
end $$;

create table if not exists club_events (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons (id) on delete cascade,
  date        date not null,
  title       text not null,
  type        club_event_type not null default 'autre',
  location    text,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists club_events_season_idx on club_events (season_id);

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons (id) on delete cascade,
  date       date not null,
  title      text not null,
  body       text not null default '',
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists announcements_season_idx on announcements (season_id);

-- ── RLS : lecture tout membre ; écriture trésorerie / resp. événement /
--    président ─────────────────────────────────────────────────────────
alter table club_events enable row level security;
alter table club_events force row level security;
alter table announcements enable row level security;
alter table announcements force row level security;

drop policy if exists club_events_read on club_events;
create policy club_events_read on club_events for select to authenticated
  using (app_can_read());
drop policy if exists club_events_write on club_events;
create policy club_events_write on club_events for all to authenticated
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

drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements for select to authenticated
  using (app_can_read());
drop policy if exists announcements_write on announcements;
create policy announcements_write on announcements for all to authenticated
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

-- ── Audit métier générique (création / modif / suppression) ──────────
create or replace function log_vieclub_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id(); mail text := app_member_email();
  kind text := tg_argv[0]; -- 'clubevent' | 'announcement'
  lbl  text := coalesce(new.title, old.title);
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

drop trigger if exists club_events_audit on club_events;
create trigger club_events_audit
  after insert or update or delete on club_events
  for each row execute function log_vieclub_audit('clubevent');

drop trigger if exists announcements_audit on announcements;
create trigger announcements_audit
  after insert or update or delete on announcements
  for each row execute function log_vieclub_audit('announcement');

-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table club_events;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table announcements;
exception when others then null;
end $$;
