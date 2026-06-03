-- Miss UWH — Données de référence (catégories) + club initial.
-- Le premier administrateur se crée via Supabase Auth puis on rattache son
-- `members.auth_id` avec le rôle admin_technique (cf. supabase/README.md).

insert into clubs (id, name, affiliation)
values ('00000000-0000-0000-0000-000000000001', 'Clermont Hockey Sub', 'FFESSM + AURA + OMS')
on conflict do nothing;

insert into categories (code, label, sens, kind, components) values
  ('R1', 'Inscriptions / Cotisations', 'recette', 'exploitation',
   array['adulte_plein','adulte_reduit','enfant','assurance_loisir','assurance_piscine','assurance_perso','licence','aides','pass_region','parrainage']),
  ('R2', 'Subventions', 'recette', 'exploitation', null),
  ('R3', 'Remboursements FFESSM', 'recette', 'exploitation', null),
  ('R4', 'Stages France / Jeunes', 'recette', 'exploitation', null),
  ('R5', 'Tournoi des Arvernes — inscriptions', 'recette', 'exploitation', null),
  ('R6', 'Buvette TDA + CDF', 'recette', 'exploitation', null),
  ('R7', 'Vente de matériels', 'recette', 'exploitation', null),
  ('R8', 'Remboursement frais bancaires / Soutien asso', 'recette', 'exploitation', null),
  ('R9', 'Participations financières / déplacements', 'recette', 'exploitation', null),
  ('R-INT', 'Intérêts livret', 'recette', 'exploitation', null),
  ('R-COMP', 'Gratuité location piscine (compensée)', 'recette', 'compensee', null),
  ('R-REG', 'Régularisations (recette)', 'recette', 'regularisation', null),
  ('D1', 'Licences FFESSM', 'depense', 'exploitation', array['adulte','jeune','enfant','transfert']),
  ('D2', 'Assurances individuelles', 'depense', 'exploitation', array['piscine','loisirs1','loisirs2','loisirs3','dirigeants']),
  ('D3', 'Affiliations FFESSM + AURA + OMS', 'depense', 'exploitation', null),
  ('D4', 'Achat de matériels de hockey', 'depense', 'exploitation', null),
  ('D5', 'Frais de déplacement', 'depense', 'exploitation', null),
  ('D6', 'Déplacements jeunes / stages / tournois', 'depense', 'exploitation', null),
  ('D7', 'Tournoi des Arvernes + Championnat', 'depense', 'exploitation', null),
  ('D8', 'Frais de bouche', 'depense', 'exploitation', null),
  ('D9', 'Location matériels piscine + cartes', 'depense', 'exploitation', null),
  ('D10', 'Frais d''inscription compétitions', 'depense', 'exploitation', null),
  ('D11', 'Formation / recyclage', 'depense', 'exploitation', null),
  ('D12', 'Divers / frais bancaires', 'depense', 'exploitation', null),
  ('D13', 'Communication', 'depense', 'exploitation', null),
  ('D-COMP', 'Location piscine (compensée)', 'depense', 'compensee', null),
  ('D-REG', 'Régularisations (dépense)', 'depense', 'regularisation', null)
on conflict (code) do update set
  label = excluded.label, sens = excluded.sens,
  kind = excluded.kind, components = excluded.components;

insert into seasons (club_id, label, start_date, end_date, opening_balance)
values ('00000000-0000-0000-0000-000000000001', '2025-2026', '2025-05-15', '2026-05-15', 2364.85)
on conflict (club_id, label) do nothing;

-- Après inscription du premier utilisateur via Supabase Auth, exécuter :
--   insert into members (auth_id, club_id, email, display_name, roles, mfa_required)
--   values ('<auth.users.id>', '00000000-0000-0000-0000-000000000001',
--           'tresorier@club.fr', 'Trésorier', array['admin_technique','tresorier']::app_role[], true);
