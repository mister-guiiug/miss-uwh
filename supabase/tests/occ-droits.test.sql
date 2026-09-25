-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Miss UWH — `update_entry_checked` sous la RLS (0020). pgTAP.              ║
-- ║                                                                          ║
-- ║ CE QUE CE FICHIER ÉTABLIT : l'écriture « à version attendue » n'accorde  ║
-- ║ PAS plus de droits qu'une écriture directe. Jusqu'à 0020, la fonction    ║
-- ║ était `security definer`, sans contrôle de rôle : un simple membre       ║
-- ║ pouvait modifier n'importe quelle écriture de son club.                  ║
-- ║                                                                          ║
-- ║ Les cas sont ceux des politiques `entries_update` (0002) :               ║
-- ║   - Alice, trésorière, écrit tout, mais pas sur une version périmée ;    ║
-- ║   - Bob, simple membre, lit tout et n'écrit rien ;                       ║
-- ║   - Eve, responsable matériel, n'écrit que D4/R7 et ne peut en sortir ;  ║
-- ║   - un visiteur sans session n'appelle même pas la fonction.            ║
-- ║                                                                          ║
-- ║ Mêmes précautions que `suppression-compte.test.sql` : aucune assertion  ║
-- ║ n'est jouée sous `authenticated`, le SQLSTATE de l'appel est déposé dans ║
-- ║ un réglage de session et relu une fois le rôle rendu.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(14);

-- Rend le SQLSTATE d'une instruction, ou « aucune erreur ». SECURITY INVOKER :
-- elle s'exécute sous le rôle courant, c'est tout son intérêt.
create function uwh_t_occ(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return 'aucune erreur';
exception
  when others then return sqlstate;
end
$fn$;

grant execute on function uwh_t_occ(text) to authenticated, anon;

-- ── Décor : trois comptes du club, une saison ouverte, deux écritures ──────

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('51111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice.occ@exemple.test', now(), now()),
  ('52222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob.occ@exemple.test', now(), now()),
  ('53333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'eve.occ@exemple.test', now(), now());

insert into members (id, auth_id, club_id, email, display_name, roles) values
  ('d0000000-0000-4000-8000-000000000001',
   '51111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000001',
   'alice.occ@exemple.test', 'Alice', array['tresorier']::app_role[]),
  ('d0000000-0000-4000-8000-000000000002',
   '52222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000001',
   'bob.occ@exemple.test', 'Bob', array['membre']::app_role[]),
  ('d0000000-0000-4000-8000-000000000003',
   '53333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000001',
   'eve.occ@exemple.test', 'Eve', array['resp_materiel']::app_role[]);

insert into seasons (id, club_id, label, start_date, end_date, opening_balance)
values
  ('e0000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'OCC ouverte', '2025-05-15', '2026-05-15', 0);

insert into entries (id, season_id, category_code, date, label, sens, amount, created_by)
values
  ('f0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001',
   'R1', '2025-09-01', 'Cotisations septembre', 'credit', 640.00,
   'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001',
   'D4', '2025-09-10', 'Crosses', 'debit', 50.00,
   'd0000000-0000-4000-8000-000000000001');

-- ── 1. La fonction s'exécute avec les droits de l'appelant ─────────────────

select is(
  (select prosecdef from pg_proc where proname = 'update_entry_checked'),
  false,
  'update_entry_checked est SECURITY INVOKER : son update subit la RLS'
);

-- ── 2. Bob, simple membre : il lit l'écriture, il ne la modifie pas ────────

select set_config(
  'request.jwt.claims',
  '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.lu', (select count(*)::text from entries
  where id = 'f0000000-0000-4000-8000-000000000001'), true);
select set_config('uwh.res', uwh_t_occ($$
  select update_entry_checked('f0000000-0000-4000-8000-000000000001', 1,
    '{"label":"Détourné","amount":"1"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.lu'), '1', 'Bob LIT l''écriture de son club');
select is(current_setting('uwh.res'), '42501',
  'mais son appel est refusé : droits insuffisants');
select is(
  (select label || ' / ' || amount::text || ' / v' || version::text from entries
    where id = 'f0000000-0000-4000-8000-000000000001'),
  'Cotisations septembre / 640.00 / v1',
  '... et l''écriture n''a pas bougé d''un champ'
);

-- ── 3. Alice, trésorière : pas sur une version périmée ─────────────────────

select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', uwh_t_occ($$
  select update_entry_checked('f0000000-0000-4000-8000-000000000001', 7,
    '{"label":"Cotisations"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.res'), '40001',
  'une version attendue périmée est un CONFLIT (40001), pas un refus');

-- ── 4. Alice, sur la bonne version : l'écriture passe et la version monte ──

select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', update_entry_checked(
  'f0000000-0000-4000-8000-000000000001', 1,
  '{"label":"Cotisations de septembre","amount":"660"}'::jsonb)::text, true);
reset role;

select is(current_setting('uwh.res'), '2', 'la fonction rend la NOUVELLE version');
select is(
  (select label || ' / ' || amount::text || ' / v' || version::text from entries
    where id = 'f0000000-0000-4000-8000-000000000001'),
  'Cotisations de septembre / 660.00 / v2',
  '... et l''écriture porte le patch'
);

-- ── 5. Eve, responsable matériel : D4 oui, R1 non, et pas de sortie de D4 ──

select set_config(
  'request.jwt.claims',
  '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.r1', uwh_t_occ($$
  select update_entry_checked('f0000000-0000-4000-8000-000000000001', 2,
    '{"label":"Hors de mon périmètre"}'::jsonb)
$$), true);
select set_config('uwh.d4', uwh_t_occ($$
  select update_entry_checked('f0000000-0000-4000-8000-000000000002', 1,
    '{"label":"Crosses neuves"}'::jsonb)
$$), true);
select set_config('uwh.sortie', uwh_t_occ($$
  select update_entry_checked('f0000000-0000-4000-8000-000000000002', 2,
    '{"category_code":"D1"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.r1'), '42501',
  'Eve ne touche pas une écriture R1');
select is(current_setting('uwh.d4'), 'aucune erreur',
  'Eve modifie une écriture D4, qui est son périmètre');
select is(current_setting('uwh.sortie'), '42501',
  'Eve ne fait pas sortir une écriture de D4 : le WITH CHECK s''applique');
select is(
  (select category_code || ' / ' || label || ' / v' || version::text from entries
    where id = 'f0000000-0000-4000-8000-000000000002'),
  'D4 / Crosses neuves / v2',
  '... et l''écriture D4 est restée en D4'
);

-- ── 6. Sans session : la fonction n'est même pas exécutable ────────────────

select set_config('request.jwt.claims', '', true);
set role anon;
select set_config('uwh.res', uwh_t_occ($$
  select update_entry_checked('f0000000-0000-4000-8000-000000000001', 2,
    '{"label":"Anonyme"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.res'), '42501', 'anon ne peut pas appeler la fonction');
select ok(
  not has_function_privilege('anon', 'update_entry_checked(uuid, int, jsonb)', 'execute'),
  'le droit d''exécution est retiré à anon'
);
select ok(
  has_function_privilege('authenticated', 'update_entry_checked(uuid, int, jsonb)', 'execute'),
  '... et laissé à authenticated'
);

select * from finish();

rollback;
