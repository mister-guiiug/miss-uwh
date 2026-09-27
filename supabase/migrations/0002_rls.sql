-- Miss UWH — Row Level Security (RBAC strict, deny-by-default).
-- Aucune table n'est lisible/écrivable sans politique explicite. La clé anon du
-- bundle public est donc sûre : tout est arbitré ici, côté serveur.
--
-- Modèle de rôles :
--   admin_technique   : tout (administration)
--   tresorier         : CRUD complet sur la comptabilité du club
--   tresorier_adjoint : CRUD complet (suppléant)
--   president         : lecture + clôture/réouverture de saison (validation)
--   resp_evenement    : écritures rattachées à un événement + lecture
--   resp_materiel     : écritures matériel (D4 achat, R7 vente) + lecture
--   controleur        : lecture seule de TOUT, y compris l'audit (vérification)
--   membre            : lecture seule des données comptables (transparence)

-- ── Helpers (SECURITY DEFINER : contournent la RLS pour éviter la récursion) ──
create or replace function app_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from members where auth_id = auth.uid() and active limit 1
$$;

create or replace function app_member_email()
returns text language sql stable security definer set search_path = public as $$
  select email from members where auth_id = auth.uid() limit 1
$$;

create or replace function app_roles()
returns app_role[] language sql stable security definer set search_path = public as $$
  select coalesce((select roles from members where auth_id = auth.uid() and active), '{}')
$$;

create or replace function app_has_role(r app_role)
returns boolean language sql stable security definer set search_path = public as $$
  -- `auth.uid()` est redondant avec `app_roles()` (qui le lit déjà), mais il
  -- doit apparaître dans le corps : VICE exige un contrôle d'identité visible
  -- dans toute fonction `security definer`.
  select auth.uid() is not null and r = any(app_roles())
$$;

create or replace function app_is_admin()
returns boolean language sql stable as $$
  select app_has_role('admin_technique')
$$;

-- Peut écrire la comptabilité (trésorerie + admin).
create or replace function app_can_write_accounting()
returns boolean language sql stable as $$
  select app_roles() && array['admin_technique','tresorier','tresorier_adjoint']::app_role[]
$$;

-- Peut lire la comptabilité (tout rôle authentifié et actif du club).
create or replace function app_can_read()
returns boolean language sql stable as $$
  select array_length(app_roles(), 1) is not null
$$;

-- Peut valider / clôturer (président + admin + trésorier).
create or replace function app_can_validate()
returns boolean language sql stable as $$
  select app_roles() && array['admin_technique','tresorier','president']::app_role[]
$$;

-- Accès à l'audit sécurité (admin + contrôleur uniquement).
create or replace function app_can_read_security()
returns boolean language sql stable as $$
  select app_roles() && array['admin_technique','controleur']::app_role[]
$$;

-- ── Activation de la RLS sur toutes les tables ───────────────────────
-- ÉNONCÉ À PLAT, volontairement : un `execute format(...)` dynamique
-- suffisait à Postgres, mais VICE (audit statique) ne le voit pas comme un
-- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` et signalait « table created
-- without RLS ». Les neuf paires sont idempotentes.
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

-- ── Référentiel : lecture authentifiée, écriture admin ───────────────
create policy categories_read on categories for select to authenticated
  using (app_can_read());
create policy categories_admin on categories for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

create policy clubs_read on clubs for select to authenticated using (app_can_read());
create policy clubs_admin on clubs for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- ── Membres : chacun se voit, l'admin gère tout ──────────────────────
create policy members_self_read on members for select to authenticated
  using (auth_id = auth.uid() or app_is_admin() or app_has_role('controleur'));
create policy members_admin on members for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- ── Saisons : lecture pour tous, écriture trésorerie, clôture validation ──
create policy seasons_read on seasons for select to authenticated using (app_can_read());
create policy seasons_insert on seasons for insert to authenticated
  with check (app_can_write_accounting());
-- Mise à jour comptable (libellé, reliquat) : trésorerie ; clôture/réouverture
-- (changement de `status`) : validée par un valideur. On autorise l'UPDATE aux
-- deux ensembles, le détail clôture/réouverture étant tracé en audit_securite.
create policy seasons_update on seasons for update to authenticated
  using (app_can_write_accounting() or app_can_validate())
  with check (app_can_write_accounting() or app_can_validate());

-- ── Événements : lecture tous, écriture trésorerie + resp. événement ──
create policy events_read on events for select to authenticated using (app_can_read());
create policy events_write on events for all to authenticated
  using (app_can_write_accounting() or app_has_role('resp_evenement'))
  with check (app_can_write_accounting() or app_has_role('resp_evenement'));

-- ── Écritures ────────────────────────────────────────────────────────
-- Lecture : tout membre (transparence interne).
create policy entries_read on entries for select to authenticated using (app_can_read());

-- Écriture : trésorerie (tout), resp. événement (lignes liées à un événement),
-- resp. matériel (catégories D4/R7). Le verrou de clôture est garanti par le
-- trigger `enforce_season_lock` en plus de ces politiques.
create policy entries_insert on entries for insert to authenticated
  with check (
    app_can_write_accounting()
    or (app_has_role('resp_evenement') and event_id is not null)
    or (app_has_role('resp_materiel') and category_code in ('D4','R7'))
  );
create policy entries_update on entries for update to authenticated
  using (
    app_can_write_accounting()
    or (app_has_role('resp_evenement') and event_id is not null)
    or (app_has_role('resp_materiel') and category_code in ('D4','R7'))
  )
  with check (
    app_can_write_accounting()
    or (app_has_role('resp_evenement') and event_id is not null)
    or (app_has_role('resp_materiel') and category_code in ('D4','R7'))
  );
-- Pas de DELETE physique : la suppression est logique (UPDATE deleted_at).
-- Aucune politique DELETE => DELETE refusé pour tous (deny-by-default).

-- ── Pièces justificatives ────────────────────────────────────────────
create policy attachments_read on attachments for select to authenticated using (app_can_read());
create policy attachments_write on attachments for all to authenticated
  using (app_can_write_accounting() or app_has_role('resp_evenement'))
  with check (app_can_write_accounting() or app_has_role('resp_evenement'));

-- ── Audit : append-only. Insertion réservée au backend (service role) via les
-- triggers SECURITY DEFINER ci-dessous ; lecture selon le rôle ─────────
create policy audit_metier_read on audit_metier for select to authenticated
  using (app_can_read());
create policy audit_securite_read on audit_securite for select to authenticated
  using (app_can_read_security());
-- Aucune politique insert/update/delete pour le rôle `authenticated` :
-- les écritures d'audit passent par des fonctions SECURITY DEFINER (triggers).

-- ── Journalisation automatique côté serveur (déclencheurs) ───────────
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

create trigger entries_audit
  after insert or update on entries
  for each row execute function log_entry_audit();

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

create trigger seasons_audit
  after update on seasons
  for each row execute function log_season_audit();

-- ── Stockage sécurisé des justificatifs (bucket privé `justificatifs`) ─
-- À exécuter après création du bucket privé (cf. supabase/README.md).
-- Lecture : tout membre actif ; écriture : trésorerie + resp. événement.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'justificatifs') then
    execute $p$
      create policy justificatifs_read on storage.objects for select to authenticated
        using (bucket_id = 'justificatifs' and app_can_read());
    $p$;
    execute $p$
      create policy justificatifs_write on storage.objects for insert to authenticated
        with check (bucket_id = 'justificatifs'
                    and (app_can_write_accounting() or app_has_role('resp_evenement')));
    $p$;
    execute $p$
      create policy justificatifs_delete on storage.objects for delete to authenticated
        using (bucket_id = 'justificatifs' and app_is_admin());
    $p$;
  end if;
end $$;
