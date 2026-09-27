-- Miss UWH — 0022 : constats VICE « Security and quality » (RLS / DEFINER).
--
-- CE QUE VICE SIGNALAIT (onglet Security, catégorie `vice`, 26/09/2026) :
--   1. neuf tables de 0001 « created without RLS » — fausse alerte : 0002 les
--      activait via un execute dynamique, que le détecteur ne lit pas ;
--   2. douze fonctions security definer « without auth check » — le contrôle
--      passait par app_member_id() / app_can_validate(), mais VICE exige
--      un auth.uid() LITÉRAL dans le corps ;
--   3. « Unsafe dynamic SQL » sur 0002 — les résumés d'audit construits avec
--      format + %s, et la boucle execute dynamique.
--
-- CE QUE FAIT CETTE MIGRATION (forward-only, bases déjà migrées) :
--   - réaffirme ENABLE + FORCE RLS à plat sur les neuf tables ;
--   - recrée les douze fonctions avec auth.uid() visible ;
--   - retire execute à anon/public pour close_season / reopen_season
--     (comme 0020 pour update_entry_checked) ;
--   - remplace les résumés formatés par de la concaténation (même texte).
--
-- 0002 a aussi été réécrit pour les installs neuves : cette migration reste
-- nécessaire pour les projets où 0002 est déjà appliquée.

-- ── 1. RLS explicite (idempotent) ────────────────────────────────────
alter table clubs enable row level security;
alter table clubs force row level security;
alter table members enable row level security;
alter table members force row level security;
alter table categories enable row level security;
alter table categories force row level security;
alter table seasons enable row level security;
alter table seasons force row level security;
alter table events enable row level security;
alter table events force row level security;
alter table entries enable row level security;
alter table entries force row level security;
alter table attachments enable row level security;
alter table attachments force row level security;
alter table audit_metier enable row level security;
alter table audit_metier force row level security;
alter table audit_securite enable row level security;
alter table audit_securite force row level security;

-- ── 2. Helper : contrôle d'identité visible ──────────────────────────
create or replace function app_has_role(r app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and r = any(app_roles())
$$;

-- ── 3. RPC clôture / réouverture ─────────────────────────────────────
create or replace function close_season(p_season uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_solde numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
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
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
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

revoke execute on function close_season(uuid) from public, anon;
grant execute on function close_season(uuid) to authenticated;
revoke execute on function reopen_season(uuid, text) from public, anon;
grant execute on function reopen_season(uuid, text) to authenticated;

-- ── 4. Chaînage d'audit (search_path inchangé depuis 0019) ───────────
create or replace function chain_audit_securite()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  last_hash text;
  caller uuid := auth.uid();
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

-- ── 5. Triggers d'audit ──────────────────────────────────────────────
create or replace function log_entry_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, 'entry.create', 'entry', new.id::text,
              'Écriture « ' || new.label || ' » (' || new.sens || ' ' || new.amount || ' €).',
              to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is null then
      insert into audit_securite(actor, actor_email, action, target_type, target_id, summary)
        values (act, mail, 'entry.delete', 'entry', new.id::text,
                'Suppression logique de « ' || new.label || ' ».');
    else
      insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
        values (act, mail, 'entry.update', 'entry', new.id::text,
                'Modification de « ' || new.label || ' » (v' || new.version || ').',
                to_jsonb(old), to_jsonb(new));
    end if;
  end if;
  return new;
end $$;

create or replace function log_season_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
begin
  if old.status = 'ouverte' and new.status = 'cloturee' then
    insert into audit_securite(actor, actor_email, action, target_type, target_id, summary)
      values (act, mail, 'season.close', 'season', new.id::text,
              'Clôture/verrouillage de la saison ' || new.label || '.');
  elsif old.status = 'cloturee' and new.status = 'ouverte' then
    insert into audit_securite(actor, actor_email, action, target_type, target_id, summary)
      values (act, mail, 'season.reopen', 'season', new.id::text,
              'Réouverture de ' || new.label || ' — motif : '
                || coalesce(new.reopen_reason, 'non précisé') || '.');
  end if;
  return new;
end $$;

create or replace function log_adherent_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, 'adherent.create', 'adherent', new.id::text,
              'Adhérent « ' || new.first_name || ' ' || new.last_name || ' » ajouté.',
              to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, 'adherent.update', 'adherent', new.id::text,
              'Adhérent « ' || new.first_name || ' ' || new.last_name || ' » modifié.',
              to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, 'adherent.delete', 'adherent', old.id::text,
              'Adhérent « ' || old.first_name || ' ' || old.last_name || ' » retiré.',
              to_jsonb(old));
    return old;
  end if;
end $$;

create or replace function log_category_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
begin
  -- On n'audite QUE les catégories personnalisées (custom = true).
  if not coalesce(new.custom, old.custom, false) then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary)
      values (act, mail, 'category.create', 'category', new.code,
              'Catégorie personnalisée « ' || new.label || ' » (' || new.code || ').');
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary)
      values (act, mail, 'category.delete', 'category', old.code,
              'Catégorie personnalisée « ' || old.label || ' » (' || old.code || ') retirée.');
    return old;
  end if;
end $$;

create or replace function log_guardian_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, 'guardian.create', 'guardian', new.id::text,
              'Tuteur/contact « ' || new.name || ' » (' || new.relation || ') ajouté.',
              to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, 'guardian.update', 'guardian', new.id::text,
              'Tuteur/contact « ' || new.name || ' » modifié.',
              to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, 'guardian.delete', 'guardian', old.id::text,
              'Tuteur/contact « ' || old.name || ' » retiré.',
              to_jsonb(old));
    return old;
  end if;
end $$;

create or replace function log_vieclub_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
  kind text := tg_argv[0];
  lbl  text := coalesce(new.title, old.title);
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, kind || '.create', kind, new.id::text,
              '« ' || lbl || ' » créé.', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, kind || '.update', kind, new.id::text,
              '« ' || lbl || ' » modifié.', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, kind || '.delete', kind, old.id::text,
              '« ' || lbl || ' » supprimé.', to_jsonb(old));
    return old;
  end if;
end $$;

create or replace function log_named_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act uuid := app_member_id();
  mail text := app_member_email();
  caller uuid := auth.uid();
  kind text := tg_argv[0];
  labelcol text := tg_argv[1];
  lbl text := coalesce(to_jsonb(new) ->> labelcol, to_jsonb(old) ->> labelcol, '');
begin
  if tg_op = 'INSERT' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, after)
      values (act, mail, kind || '.create', kind, new.id::text,
              '« ' || lbl || ' » créé.', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before, after)
      values (act, mail, kind || '.update', kind, new.id::text,
              '« ' || lbl || ' » modifié.', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_metier(actor, actor_email, action, target_type, target_id, summary, before)
      values (act, mail, kind || '.delete', kind, old.id::text,
              '« ' || lbl || ' » supprimé.', to_jsonb(old));
    return old;
  end if;
end $$;

create or replace function log_ai_config_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid();
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
