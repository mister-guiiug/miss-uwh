-- 0014 — Identifiant HelloAsso sur les adhérents
-- Permet de dédoublonner les imports HelloAsso par identifiant stable (et non
-- plus par email, qui peut changer). Renseigné par l'Edge Function
-- `helloasso-sync`. Colonne nullable, couverte par les politiques RLS existantes.

alter table adherents
  add column if not exists helloasso_id text;

create index if not exists adherents_helloasso_id_idx
  on adherents (season_id, helloasso_id);
