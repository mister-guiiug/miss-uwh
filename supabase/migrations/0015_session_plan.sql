-- 0015 — Plan d'exercices des séances d'entraînement
-- Liste ordonnée d'exercices planifiés (référence à la bibliothèque, durée,
-- consigne) stockée en JSONB sur la séance. Couvert par les politiques RLS
-- existantes de `training_sessions`.

alter table training_sessions
  add column if not exists plan jsonb not null default '[]'::jsonb;
