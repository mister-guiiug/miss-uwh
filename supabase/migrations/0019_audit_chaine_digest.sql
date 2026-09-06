-- Miss UWH — 0019 — le chaînage de l'audit sécurité ne trouvait pas `digest()`.
--
-- LE DÉFAUT, MESURÉ. Première exécution des migrations sur une pile jetable
-- (CI, 06/09/2026, workflow `supabase-tests.yml` posé par le chantier V9) :
--
--   ERROR: function digest(text, unknown) does not exist
--   CONTEXT: PL/pgSQL function chain_audit_securite() line 6 at assignment
--            PL/pgSQL function log_season_audit() line 5 at SQL statement
--
-- CE QUE CELA CASSAIT. `chain_audit_securite()` (0005) est un trigger BEFORE
-- INSERT sur `audit_securite` : TOUTE écriture serveur dans le journal de
-- sécurité passe par lui. Or `log_season_audit()` (0002) y insère à chaque
-- changement de statut d'une saison — c'est-à-dire à chaque appel de
-- `close_season()` et de `reopen_season()`. En mode Supabase, **clôturer une
-- saison levait donc systématiquement**, et la clôture est l'une des raisons
-- d'être de cette application.
--
-- POURQUOI PERSONNE NE L'AVAIT VU. Le poste de développement n'a pas de démon
-- Docker : jusqu'à ce chantier, aucune de ces migrations ne s'était jamais
-- EXÉCUTÉE ailleurs que sur le projet hébergé — où le chemin n'a, selon toute
-- vraisemblance, jamais été emprunté (l'app tourne en mode local). Le code se
-- relit très bien : `digest(...)` est appelé sans schéma, et rien à la lecture
-- ne dit dans quel schéma vit pgcrypto.
--
-- LA CAUSE. `create extension if not exists pgcrypto` (0001) est un NO-OP
-- quand Supabase l'a déjà installée — et elle l'est, dans le schéma
-- `extensions`, pas dans `public`. La fonction, elle, porte
-- `set search_path = public` : `digest` est donc hors de portée. La clause de
-- `search_path` est une bonne pratique de sécurité pour une fonction
-- `security definer` (elle empêche un appelant de détourner la résolution des
-- noms) ; elle ne devient un piège que lorsqu'elle omet le schéma des
-- extensions.
--
-- LE CORRECTIF. Ajouter `extensions` au `search_path`, plutôt qu'écrire
-- `extensions.digest(...)` : un schéma inexistant dans un `search_path` est
-- ignoré sans erreur, si bien que la fonction marche que pgcrypto vive dans
-- `extensions` (Supabase) ou dans `public` (une base montée à la main). Un
-- appel qualifié en dur, lui, n'aurait marché que dans un des deux cas.
--
-- Le corps est celui de 0005, à l'identique : ce commit ne change QUE la
-- résolution des noms. Idempotent.
--
-- La preuve est dans `supabase/tests/suppression-compte.test.sql`, qui clôture
-- une saison par `close_season()` et vérifie que la ligne d'audit existe ET
-- porte son hash — c'est exactement l'appel qui levait.

create or replace function chain_audit_securite()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
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

comment on function chain_audit_securite() is
  'Chaîne chaque ligne d''audit sécurité au hash de la précédente '
  '(inviolabilité). `search_path = public, extensions` : pgcrypto vit dans '
  '`extensions` sur Supabase, et un search_path réduit à `public` faisait '
  'lever TOUTE écriture serveur dans audit_securite — dont la clôture de '
  'saison (0019).';
