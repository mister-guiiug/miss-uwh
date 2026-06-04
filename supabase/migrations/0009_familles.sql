-- Miss UWH — 0009 : familles / tuteurs des adhérents (espace Adhérents, Lot A).
-- Parents, tuteur légal, contacts d'urgence rattachés à un adhérent (mineurs).
-- Mêmes politiques que `adherents` (lecture membre, écriture trésorerie/secrétaire).
-- Suppression de l'adhérent → cascade sur ses tuteurs. Migration idempotente.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'guardian_relation') then
    create type guardian_relation as enum ('pere', 'mere', 'tuteur', 'urgence');
  end if;
end $$;

create table if not exists guardians (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references adherents (id) on delete cascade,
  relation   guardian_relation not null default 'tuteur',
  name       text not null,
  phone      text,
  email      text,
  created_at timestamptz not null default now()
);
create index if not exists guardians_member_idx on guardians (member_id);

alter table guardians enable row level security;
alter table guardians force row level security;

drop policy if exists guardians_read on guardians;
create policy guardians_read on guardians for select to authenticated
  using (app_can_read());
drop policy if exists guardians_write on guardians;
create policy guardians_write on guardians for all to authenticated
  using (app_can_write_accounting()) with check (app_can_write_accounting());

-- Audit métier (création / modif / suppression).
create or replace function log_guardian_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare act uuid := app_member_id(); mail text := app_member_email();
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, 'guardian.create', 'guardian', new.id::text,
              format('Tuteur/contact « %s » (%s) ajouté.', new.name, new.relation),
              to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, 'guardian.update', 'guardian', new.id::text,
              format('Tuteur/contact « %s » modifié.', new.name),
              to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, 'guardian.delete', 'guardian', old.id::text,
              format('Tuteur/contact « %s » retiré.', old.name),
              to_jsonb(old));
    return old;
  end if;
end $$;

drop trigger if exists guardians_audit on guardians;
create trigger guardians_audit
  after insert or update or delete on guardians
  for each row execute function log_guardian_audit();

do $$
begin
  alter publication supabase_realtime add table guardians;
exception when others then null;
end $$;
