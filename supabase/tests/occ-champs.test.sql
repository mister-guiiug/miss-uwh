-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Miss UWH — `update_entry_checked` couvre tous les champs modifiés (0021). ║
-- ║ pgTAP.                                                                   ║
-- ║                                                                          ║
-- ║ CE QUE CE FICHIER ÉTABLIT : la fonction sait écrire les six colonnes que ║
-- ║ le formulaire modifie et que 0005 ignorait (`sens`, `method`,            ║
-- ║ `piece_ref`, `invoice_code`, `event_id`, `components`) ; une colonne     ║
-- ║ facultative se VIDE quand sa clé arrive à `null`, une colonne NOT NULL   ║
-- ║ reste en place ; une clé absente ne touche à rien. Et ces six colonnes   ║
-- ║ n'ouvrent aucun droit : la RLS d'`entries` (0002) les garde comme les    ║
-- ║ autres — le responsable événement ne peut pas détacher une écriture de   ║
-- ║ son événement, le simple membre ne modifie rien.                         ║
-- ║                                                                          ║
-- ║ `occ-droits.test.sql` tient le reste (refus, conflit, `anon`) ; il est   ║
-- ║ rejoué après 0021, qui ne change ni la signature ni les droits.          ║
-- ║                                                                          ║
-- ║ Mêmes précautions que les deux autres fichiers : aucune assertion n'est  ║
-- ║ jouée sous `authenticated`, le SQLSTATE de l'appel est déposé dans un    ║
-- ║ réglage de session et relu une fois le rôle rendu.                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(23);

-- Rend le SQLSTATE d'une instruction, ou « aucune erreur ». SECURITY INVOKER :
-- elle s'exécute sous le rôle courant, c'est tout son intérêt. Le bloc
-- d'exception annule l'instruction fautive, et elle seule.
create function uwh_t_champs(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return 'aucune erreur';
exception
  when others then return sqlstate;
end
$fn$;

grant execute on function uwh_t_champs(text) to authenticated, anon;

-- ── Décor : trois comptes du club, une saison ouverte, deux événements ─────
--
-- Alice — trésorière : écrit tout.
-- Bob   — simple membre : lit tout, n'écrit rien.
-- Rémi  — responsable événement : n'écrit que les écritures rattachées à un
--         événement, et ne peut pas les en faire sortir.

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('61111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice.champs@exemple.test', now(), now()),
  ('62222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob.champs@exemple.test', now(), now()),
  ('63333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'remi.champs@exemple.test', now(), now());

insert into members (id, auth_id, club_id, email, display_name, roles) values
  ('d2000000-0000-4000-8000-000000000001',
   '61111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000001',
   'alice.champs@exemple.test', 'Alice', array['tresorier']::app_role[]),
  ('d2000000-0000-4000-8000-000000000002',
   '62222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000001',
   'bob.champs@exemple.test', 'Bob', array['membre']::app_role[]),
  ('d2000000-0000-4000-8000-000000000003',
   '63333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000001',
   'remi.champs@exemple.test', 'Rémi', array['resp_evenement']::app_role[]);

insert into seasons (id, club_id, label, start_date, end_date, opening_balance)
values
  ('e2000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'OCC champs', '2025-05-15', '2026-05-15', 0);

insert into events (id, season_id, name, kind) values
  ('71000000-0000-4000-8000-000000000001',
   'e2000000-0000-4000-8000-000000000001', 'Tournoi des Arvernes', 'tournoi'),
  ('71000000-0000-4000-8000-000000000002',
   'e2000000-0000-4000-8000-000000000001', 'Buvette', 'buvette');

-- E1 : une recette complète, tous champs facultatifs remplis.
-- E2 : une dépense rattachée au tournoi — le périmètre de Rémi.
-- E3 : une dépense sans événement — hors de son périmètre.
insert into entries (id, season_id, category_code, date, label, sens, amount,
                     method, piece_ref, invoice_code, observation, event_id,
                     components, created_by)
values
  ('f2000000-0000-4000-8000-000000000001',
   'e2000000-0000-4000-8000-000000000001',
   'R1', '2025-09-01', 'Cotisations', 'credit', 640.00,
   'cheque', 'chq 001', 'FA01', 'Chèques remis', null,
   '{"adulte_plein": 640}'::jsonb,
   'd2000000-0000-4000-8000-000000000001'),
  ('f2000000-0000-4000-8000-000000000002',
   'e2000000-0000-4000-8000-000000000001',
   'D7', '2025-10-04', 'Location bassin', 'debit', 120.00,
   'virement', null, null, null, '71000000-0000-4000-8000-000000000001',
   null,
   'd2000000-0000-4000-8000-000000000001'),
  ('f2000000-0000-4000-8000-000000000003',
   'e2000000-0000-4000-8000-000000000001',
   'D8', '2025-10-05', 'Goûter', 'debit', 30.00,
   'especes', null, null, null, null,
   null,
   'd2000000-0000-4000-8000-000000000001');

-- ── 1. Ce qui ne change pas : l'appelant et les droits d'exécution ─────────

select is(
  (select prosecdef from pg_proc where proname = 'update_entry_checked'),
  false,
  'update_entry_checked reste SECURITY INVOKER : son update subit la RLS'
);
select ok(
  not has_function_privilege('anon', 'update_entry_checked(uuid, int, jsonb)', 'execute'),
  'le droit d''exécution reste retiré à anon'
);
select ok(
  has_function_privilege('authenticated', 'update_entry_checked(uuid, int, jsonb)', 'execute'),
  '... et laissé à authenticated'
);

-- ── 2. Le sens voyage avec la catégorie ────────────────────────────────────
--
-- Faire d'une recette une dépense, c'est changer DEUX colonnes : le
-- déclencheur `entries_sens_guard` (0005) refuse une catégorie de dépense au
-- crédit. Avant 0021, la fonction ne savait pas écrire `sens` : ce geste-là
-- était impossible par elle.

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.seule', uwh_t_champs($$
  select update_entry_checked('f2000000-0000-4000-8000-000000000001', 1,
    '{"category_code":"D12"}'::jsonb)
$$), true);
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 1,
  '{"category_code":"D12","sens":"debit","method":"virement","piece_ref":"vir 42","invoice_code":"FA02"}'::jsonb
)::text, true);
reset role;

select is(current_setting('uwh.seule'), '23514',
  'la catégorie de dépense SANS le sens est refusée par le garde de cohérence');
select is(current_setting('uwh.res'), '2',
  'la catégorie AVEC le sens, le mode, la pièce et la facture passent : version 2');
select is(
  (select category_code || ' / ' || sens::text || ' / ' || method || ' / '
          || piece_ref || ' / ' || invoice_code || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'D12 / debit / virement / vir 42 / FA02 / v2',
  '... et les cinq colonnes portent le patch'
);

-- ── 3. Une clé absente ne touche à rien ────────────────────────────────────

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 2,
  '{"label":"Remboursement"}'::jsonb
)::text, true);
reset role;

select ok(
  (select label = 'Remboursement'
          and observation = 'Chèques remis'
          and piece_ref = 'vir 42'
          and invoice_code = 'FA02'
          and components = '{"adulte_plein": 640}'::jsonb
          and version = 3
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'un patch du seul libellé laisse l''observation, la pièce, la facture et les composantes en place'
);

-- ── 4. Une colonne facultative se vide quand sa clé arrive à `null` ────────

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 3,
  '{"observation":null,"piece_ref":null,"invoice_code":null,"components":null}'::jsonb
)::text, true);
reset role;

select ok(
  (select observation is null and piece_ref is null and invoice_code is null
          and version = 4
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'observation, pièce et facture sont VIDÉES — avec 0005, `observation` ne pouvait pas l''être'
);
select ok(
  (select components is null
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  '... et les composantes valent NULL en SQL, pas le `null` JSON'
);

-- ── 5. Une colonne NOT NULL reste en place quand sa clé arrive à `null` ────

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 4,
  '{"label":null,"amount":null,"sens":null,"method":null}'::jsonb
)::text, true);
reset role;

select is(
  (select label || ' / ' || amount::text || ' / ' || sens::text || ' / '
          || method || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'Remboursement / 640.00 / debit / virement / v5',
  'libellé, montant, sens et mode restent en place : `null` n''efface pas une colonne obligatoire'
);

-- ── 6. Les composantes et l'événement s'écrivent ───────────────────────────

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 5,
  '{"components":{"piscine":400,"loisirs1":240}}'::jsonb
)::text, true);
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 6,
  '{"event_id":"71000000-0000-4000-8000-000000000002"}'::jsonb
)::text, true);
select set_config('uwh.rattachee', (select coalesce(event_id::text, 'aucun')
  from entries where id = 'f2000000-0000-4000-8000-000000000001'), true);
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000001', 7,
  '{"event_id":null}'::jsonb
)::text, true);
reset role;

select ok(
  (select components = '{"piscine": 400, "loisirs1": 240}'::jsonb
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'les composantes s''écrivent en objet JSON'
);
select is(current_setting('uwh.rattachee'), '71000000-0000-4000-8000-000000000002',
  'l''écriture se rattache à un événement');
select is(
  (select coalesce(event_id::text, 'aucun') || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'aucun / v8',
  '... puis s''en détache par `null`'
);

-- ── 7. Les nouvelles colonnes n'échappent pas au contrôle de version ───────

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', uwh_t_champs($$
  select update_entry_checked('f2000000-0000-4000-8000-000000000001', 1,
    '{"method":"especes"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.res'), '40001',
  'une version périmée reste un CONFLIT, quel que soit le champ visé');
select is(
  (select method || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'virement / v8',
  '... et rien n''a bougé'
);

-- ── 8. Rémi, responsable événement : son périmètre, et pas davantage ───────

select set_config(
  'request.jwt.claims',
  '{"sub":"63333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.dedans', uwh_t_champs($$
  select update_entry_checked('f2000000-0000-4000-8000-000000000002', 1,
    '{"label":"Location du bassin","piece_ref":"FA-77"}'::jsonb)
$$), true);
select set_config('uwh.detache', uwh_t_champs($$
  select update_entry_checked('f2000000-0000-4000-8000-000000000002', 2,
    '{"event_id":null}'::jsonb)
$$), true);
select set_config('uwh.dehors', uwh_t_champs($$
  select update_entry_checked('f2000000-0000-4000-8000-000000000003', 1,
    '{"label":"Hors de mon périmètre"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.dedans'), 'aucune erreur',
  'Rémi modifie le libellé et la pièce d''une écriture rattachée à un événement');
select is(current_setting('uwh.detache'), '42501',
  'Rémi ne peut pas la DÉTACHER de l''événement : le WITH CHECK s''applique à event_id');
select is(
  (select event_id::text || ' / ' || piece_ref || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000002'),
  '71000000-0000-4000-8000-000000000001 / FA-77 / v2',
  '... et l''écriture reste rattachée, avec la seule modification permise'
);
select is(current_setting('uwh.dehors'), '42501',
  'Rémi ne touche pas une écriture sans événement');

-- ── 9. Bob, simple membre : les nouvelles colonnes ne lui ouvrent rien ─────

select set_config(
  'request.jwt.claims',
  '{"sub":"62222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', uwh_t_champs($$
  select update_entry_checked('f2000000-0000-4000-8000-000000000001', 8,
    '{"method":"especes","piece_ref":"détourné"}'::jsonb)
$$), true);
reset role;

select is(current_setting('uwh.res'), '42501',
  'Bob, sur la bonne version, est refusé : droits insuffisants');
select is(
  (select method || ' / ' || coalesce(piece_ref, 'aucune') || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000001'),
  'virement / aucune / v8',
  '... et l''écriture n''a pas bougé'
);

-- ── 10. La suppression logique et la restauration passent toujours ────────

select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set role authenticated;
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000003', 1,
  '{"deleted_at":"2025-10-06T10:00:00Z","observation":"Suppression : doublon"}'::jsonb
)::text, true);
select set_config('uwh.supprimee', (select (deleted_at is not null)::text
  from entries where id = 'f2000000-0000-4000-8000-000000000003'), true);
select set_config('uwh.res', update_entry_checked(
  'f2000000-0000-4000-8000-000000000003', 2,
  '{"deleted_at":null}'::jsonb
)::text, true);
reset role;

select is(current_setting('uwh.supprimee'), 'true',
  'la suppression logique pose deleted_at');
select is(
  (select coalesce(deleted_at::text, 'restaurée') || ' / ' || observation
          || ' / v' || version::text
     from entries where id = 'f2000000-0000-4000-8000-000000000003'),
  'restaurée / Suppression : doublon / v3',
  '... et la restauration le remet à NULL sans toucher à l''observation'
);

select * from finish();

rollback;
