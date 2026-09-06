-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Miss UWH — supprimer son compte. pgTAP, joué par `supabase test db`.      ║
-- ║                                                                          ║
-- ║ CE QUE CE FICHIER ÉTABLIT, et que ce parc n'avait jamais exécuté :       ║
-- ║ qu'une fonction `security definer` appartenant à `postgres` peut         ║
-- ║ supprimer une ligne d'`auth.users`. mister-doc s'appuie dessus en        ║
-- ║ production depuis des mois (`delete_my_account`, `anonymize_doctor`)     ║
-- ║ sans une seule assertion ; AMELIORATIONS.md porte la réserve depuis le   ║
-- ║ 05/09/2026. Le poste de développement n'a pas de démon Docker : la CI    ║
-- ║ est le seul endroit où la question reçoit une réponse.                   ║
-- ║                                                                          ║
-- ║ LA RÉPONSE, MESURÉE (CI du 06/09/2026, première exécution) :             ║
-- ║                                                                          ║
-- ║   propriétaire de auth.users : supabase_auth_admin                       ║
-- ║   rolsuper(postgres)         : FALSE                                     ║
-- ║   rolbypassrls(postgres)     : true                                      ║
-- ║   has_table_privilege(postgres, auth.users, DELETE) : TRUE               ║
-- ║                                                                          ║
-- ║ C'est ce qui fait de cette exécution une réponse, et pas une             ║
-- ║ tautologie : `postgres` n'est PAS superutilisateur sur cette pile — le   ║
-- ║ CLI reproduit la configuration de rôles de l'hébergé — et `auth.users`   ║
-- ║ ne lui appartient pas. Le droit de DELETE vient donc d'un GRANT, celui   ║
-- ║ que Supabase accorde, et la fonction efface réellement (assertions 14    ║
-- ║ et 17). Les quatre valeurs restent imprimées en `diag` : le jour où      ║
-- ║ l'une d'elles change, le journal d'Actions le dira avant l'échec.        ║
-- ║                                                                          ║
-- ║ LE MODE D'ÉCHEC REDOUTÉ EST LE SILENCE. 0002 pose `force row level       ║
-- ║ security` sur `members` : si le propriétaire de la fonction perdait      ║
-- ║ BYPASSRLS, l'anonymisation serait FILTRÉE — zéro ligne modifiée, aucune  ║
-- ║ erreur, et un appel qui « réussit ». On compte donc les lignes avant et  ║
-- ║ après, au lieu de se contenter d'un appel qui n'a pas levé.              ║
-- ║                                                                          ║
-- ║ LE DÉCOR EST COMPTÉ AVANT. « Plus une ligne » est vrai d'une base vide.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(26);

-- ── Un outil : rendre le SQLSTATE plutôt que de plaider auprès de `throws_ok`,
--    surchargée, et qu'aucune combinaison de casts n'avait domptée sur ce parc
--    (mister-miss-koh, 05/09/2026). SECURITY INVOKER — elle s'exécute sous le
--    rôle courant, ce qui est tout son intérêt.
create function uwh_t_try(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return 'aucune erreur';
exception
  when others then return sqlstate;
end
$fn$;

grant execute on function uwh_t_try(text) to authenticated;

-- AUCUNE ASSERTION N'EST JOUÉE SOUS `authenticated`. Se faire passer pour un
-- membre sert à appeler la FONCTION, pas à juger : `is()` et `ok()` vivent
-- dans le schéma `extensions`, et faire dépendre le verdict des droits que ce
-- rôle y possède, c'est se donner une chance d'échouer pour une raison qui
-- n'est pas la bonne. Le résultat de l'appel est donc déposé dans un réglage
-- de session (`is_local`, annulé avec la transaction), relu une fois le rôle
-- rendu.

-- ── Décor : quatre comptes du même club ───────────────────────────────────
--
-- Alice  — trésorière ET administratrice, sa signature est sur les livres.
-- Bob    — simple membre, n'a jamais rien écrit.
-- Carol  — seconde administratrice : sans elle, la garde du dernier
--          administrateur refuserait le départ d'Alice.
-- Dave   — simple membre actif : il reste, et c'est ce qui rend la garde
--          opposable à Carol une fois Alice et Bob partis.

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@exemple.test', now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@exemple.test', now(), now()),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@exemple.test', now(), now()),
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dave@exemple.test', now(), now());

insert into members (id, auth_id, club_id, email, display_name, roles) values
  ('a0000000-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000001',
   'alice@exemple.test', 'Alice',
   array['admin_technique','tresorier']::app_role[]),
  ('a0000000-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000001',
   'bob@exemple.test', 'Bob', array['membre']::app_role[]),
  ('a0000000-0000-4000-8000-000000000003',
   '33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000001',
   'carol@exemple.test', 'Carol',
   array['admin_technique']::app_role[]),
  ('a0000000-0000-4000-8000-000000000004',
   '44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000001',
   'dave@exemple.test', 'Dave', array['membre']::app_role[]);

-- Deux saisons, dont une que l'on CLÔTURERA. C'est le cœur du dossier : le
-- trigger `entries_lock_guard` (0001) lève sur tout UPDATE d'une écriture
-- rattachée à une saison clôturée. Une fonction qui, pour effacer un membre,
-- passerait ses écritures à NULL échouerait donc précisément pour le trésorier
-- de la saison passée — celui qui a le plus de raisons de partir.
insert into seasons (id, club_id, label, start_date, end_date, opening_balance)
values
  ('b0000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Test ouverte', '2024-05-15', '2025-05-15', 0),
  ('b0000000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Test cloturee', '2023-05-15', '2024-05-15', 0);

insert into entries (id, season_id, category_code, date, label, sens, amount, created_by)
values
  ('c0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001',
   'R1', '2024-09-01', 'Cotisations septembre', 'credit', 640.00,
   'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000002',
   'D1', '2023-10-01', 'Licences FFESSM', 'debit', 1420.50,
   'a0000000-0000-4000-8000-000000000001');

-- La clôture APRÈS l'écriture (le trigger l'interdirait dans l'autre sens),
-- et par le VRAI chemin de production : la RPC `close_season()` (0005),
-- appelée par Alice. Elle pose `seasons.locked_by = app_member_id()` et
-- déclenche `log_season_audit()` (0002), qui écrit dans `audit_securite` —
-- donc le chaînage par hash de 0005.
--
-- C'EST CET APPEL QUI A RÉVÉLÉ LE DÉFAUT CORRIGÉ PAR 0019 : à la première
-- exécution réelle de ces migrations, il levait « function digest(text,
-- unknown) does not exist ». Clôturer une saison en mode Supabase était donc
-- impossible, et personne ne le savait — faute d'un endroit où les migrations
-- s'exécutent.
--
-- L'identité vient du JETON, pas du rôle : `auth.uid()` ne lit qu'un réglage
-- de session, et `app_member_id()` en dérive Alice. On reste donc sous
-- `postgres` pour ce montage — le décor n'a pas à dépendre, en plus, des
-- droits d'exécution de `close_season()` pour `authenticated`, qui sont une
-- autre question que celle de ce fichier.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.close_season('b0000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims', '', true);

-- Le hash de la ligne d'audit ainsi écrite, mis de côté : on vérifiera après
-- l'effacement qu'il n'a pas bougé — retirer l'adresse ne doit pas rompre la
-- preuve d'inviolabilité du journal du club.
select set_config(
  'uwh.hash',
  (select hash from audit_securite
    where actor = 'a0000000-0000-4000-8000-000000000001'),
  true
);

-- Le journal métier porte une COPIE de l'adresse : elle survivrait à la ligne
-- `members` par construction, c'est tout l'intérêt d'une dénormalisation.
insert into audit_metier (actor, actor_email, action, target_type, target_id, summary)
values ('a0000000-0000-4000-8000-000000000001', 'alice@exemple.test',
        'entry.create', 'entry', 'c0000000-0000-4000-8000-000000000001',
        'Création d''une écriture de 640,00 €.');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Les faits, imprimés — ce que le journal d'Actions doit montrer.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select diag(
  'propriétaire de auth.users                        : '
  || (select pg_get_userbyid(relowner) from pg_class where oid = 'auth.users'::regclass)
);

select diag(
  'has_table_privilege(postgres, auth.users, DELETE) : '
  || has_table_privilege('postgres', 'auth.users', 'delete')::text
  || '   <<< LA question : une fonction SECURITY DEFINER de postgres peut-elle effacer un compte ?'
);

select diag(
  'rolsuper(postgres)                                : '
  || (select rolsuper::text from pg_roles where rolname = 'postgres')
  || '   <<< D''OÙ vient le droit ci-dessus. false (mesuré) => d''un GRANT, et'
  || ' la réponse vaut pour l''hébergé, qui a la même configuration de rôles.'
  || ' true dirait au contraire que cette exécution ne tranche rien.'
);

select diag(
  'rolbypassrls(postgres)                            : '
  || (select rolbypassrls::text from pg_roles where rolname = 'postgres')
  || '   <<< ce qui franchit le « force row level security » de 0002'
);

-- Le trigger `chain_audit_securite` (0005) appelle `digest()` avec un
-- `search_path` réduit à `public`. Si pgcrypto vit dans `extensions`, tout
-- INSERT serveur dans `audit_securite` lèverait. Aucune assertion ici : rien
-- n'écrit ce journal côté serveur aujourd'hui (le client ne fait que le lire),
-- et ce n'est pas le sujet de cette migration. La valeur est imprimée pour
-- qu'on cesse de le supposer.
select diag(
  'schéma de pgcrypto                                : '
  || coalesce(
       (select n.nspname
          from pg_extension e join pg_namespace n on n.oid = e.extnamespace
         where e.extname = 'pgcrypto'),
       '(absente)')
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Le mécanisme : d'où la fonction tient son pouvoir.                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.delete_my_account()'::regprocedure),
  'delete_my_account() est SECURITY DEFINER — sans cela elle s''exécuterait avec les droits de l''appelant, qui n''en a aucun'
);

select is(
  (select pg_get_userbyid(proowner)::text from pg_proc
    where oid = 'public.delete_my_account()'::regprocedure),
  'postgres'::text,
  '... et appartient à postgres : c''est de LUI qu''elle emprunte auth.users et BYPASSRLS'
);

select ok(
  has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'),
  'un membre connecté peut l''appeler'
);

-- Les droits par défaut de Supabase NOMMENT `anon` : révoquer PUBLIC ne suffit
-- pas. L'appel lèverait de toute façon (auth.uid() nul), mais une fonction qui
-- efface des comptes n'a pas à être atteignable par la clé publique du bundle.
select ok(
  not has_function_privilege('anon', 'public.delete_my_account()', 'execute'),
  '... et un visiteur anonyme, non'
);

-- L'HYPOTHÈSE, et la réponse : `postgres` n'est pas superutilisateur ici (cf.
-- le `diag` ci-dessus) et `auth.users` appartient à `supabase_auth_admin` —
-- ce droit ne peut donc venir que d'un GRANT. Si cette assertion tombait un
-- jour, 0018 ne pourrait plus tenir sa promesse et le repli serait
-- l'anonymisation seule — laquelle laisse un compte, donc une adresse connue
-- du service.
select ok(
  has_table_privilege('postgres', 'auth.users', 'delete'),
  'le propriétaire des fonctions a le droit de DELETE sur auth.users — accordé, pas hérité du superutilisateur'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Le décor est bien là — sinon « plus une ligne » ne dirait rien.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select is(
  (select count(*)::int from members
    where club_id = '00000000-0000-0000-0000-000000000001'),
  4,
  'décor : quatre membres du club'
);

select is(
  (select count(*)::int from entries
    where created_by = 'a0000000-0000-4000-8000-000000000001'),
  2,
  'décor : Alice a signé deux écritures, dont une en saison CLÔTURÉE'
);

-- L'assertion qui tient 0019. Sans le `search_path` corrigé, `close_season()`
-- ci-dessus n'aurait pas seulement laissé cette ligne vide : il aurait LEVÉ,
-- et ce fichier entier n'aurait produit aucun verdict.
select ok(
  (select hash is not null from audit_securite
    where actor = 'a0000000-0000-4000-8000-000000000001'
      and action = 'season.close'),
  'décor : la clôture a écrit sa ligne d''audit sécurité, chaînée par hash (0019)'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Sans session, la fonction refuse — plutôt que d'effacer au hasard.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config('request.jwt.claims', '', true);
set role authenticated;
select set_config('uwh.res', uwh_t_try($$ select public.delete_my_account() $$), true);
reset role;

select is(
  current_setting('uwh.res'),
  '42501'::text,
  'sans session (auth.uid() nul), l''appel est refusé'
);

select is(
  (select count(*)::int from auth.users
    where email like '%@exemple.test'),
  4,
  '... et les quatre comptes sont toujours là'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Bob n'a rien signé : sa ligne part entièrement.                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', public.delete_my_account(), true);
reset role;

select is(
  current_setting('uwh.res'),
  'supprime'::text,
  'un membre qui n''a rien écrit est SUPPRIMÉ, et la fonction le dit'
);

select is(
  (select count(*)::int from members
    where id = 'a0000000-0000-4000-8000-000000000002'),
  0,
  '... plus une ligne dans members'
);

select is(
  (select count(*)::int from auth.users
    where id = '22222222-2222-2222-2222-222222222222'),
  0,
  '... et son compte a disparu d''auth.users : une suppression, pas une anonymisation'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Alice a signé les livres du club : son compte part, sa signature reste ║
-- ║    — anonyme. C'est ici que se joue le trigger de clôture : une fonction  ║
-- ║    qui toucherait aux écritures lèverait sur la saison clôturée.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', public.delete_my_account(), true);
reset role;

select is(
  current_setting('uwh.res'),
  'anonymise'::text,
  'la trésorière de la saison clôturée peut partir, et la fonction dit « anonymise »'
);

select is(
  (select count(*)::int from auth.users
    where id = '11111111-1111-1111-1111-111111111111'),
  0,
  '... son compte a disparu d''auth.users'
);

select ok(
  (select auth_id is null and display_name is null and not active
            and roles = array['membre']::app_role[]
            and email like 'supprime+%@invalid'
     from members where id = 'a0000000-0000-4000-8000-000000000001'),
  '... sa ligne members ne porte plus une donnée personnelle (le « force row level security » de 0002 n''a rien filtré)'
);

select is(
  (select count(*)::int from entries
    where created_by = 'a0000000-0000-4000-8000-000000000001'),
  2,
  '... les deux écritures du club sont intactes, y compris celle de la saison clôturée'
);

select is(
  (select count(*)::int from seasons
    where locked_by = 'a0000000-0000-4000-8000-000000000001'),
  1,
  '... et la clôture qu''elle a prononcée reste opposable'
);

select is(
  (select actor_email from audit_metier
    where actor = 'a0000000-0000-4000-8000-000000000001'),
  null::text,
  '... mais son adresse a quitté le journal d''audit'
);

select is(
  (select count(*)::int from audit_metier
    where actor = 'a0000000-0000-4000-8000-000000000001'),
  1,
  '... sans que la ligne d''audit elle-même disparaisse : le journal du club reste complet'
);

select is(
  (select actor_email from audit_securite
    where actor = 'a0000000-0000-4000-8000-000000000001'),
  null::text,
  '... et du journal de SÉCURITÉ, qui portait aussi son adresse'
);

-- Le chaînage de 0005 couvre `ts`, `action`, `target_id` et `summary` — pas
-- `actor_email`. Retirer l'adresse ne rompt donc AUCUNE preuve : le journal
-- reste vérifiable, il ne nomme simplement plus personne. Cette assertion est
-- la seule façon de le savoir sans relire le trigger.
select is(
  (select hash from audit_securite
    where actor = 'a0000000-0000-4000-8000-000000000001'),
  current_setting('uwh.hash'),
  '... sans rompre le chaînage par hash : le journal reste vérifiable'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. La garde : le dernier administrateur n'enferme pas le club dehors.     ║
-- ║    Alice n'est plus administratrice, Bob est parti — Carol est seule à    ║
-- ║    pouvoir attribuer un rôle, et Dave est toujours actif.                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', uwh_t_try($$ select public.delete_my_account() $$), true);
reset role;

select is(
  current_setting('uwh.res'),
  '42501'::text,
  'le dernier administrateur est refusé tant qu''un autre membre actif reste'
);

select is(
  (select count(*)::int from auth.users
    where id = '33333333-3333-3333-3333-333333333333'),
  1,
  '... et son compte n''a pas été touché au passage'
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Et le voisin n'a rien senti.                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Une fonction qui efface « les données de l'utilisateur » et se trompe de
-- filtre est silencieuse : elle rend une valeur, et le compte d'à côté est
-- perdu.

select is(
  (select count(*)::int from auth.users
    where id = '44444444-4444-4444-4444-444444444444'),
  1,
  'le compte de Dave est intact'
);

select is(
  (select email from members
    where id = 'a0000000-0000-4000-8000-000000000004'),
  'dave@exemple.test'::text,
  '... et sa ligne membre aussi'
);

select * from finish();

rollback;
