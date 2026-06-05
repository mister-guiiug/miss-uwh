-- 0013 — Échéances adhérents
-- Suivi des renouvellements : dates d'expiration de la licence et du certificat
-- médical (obligation réglementaire en sport, notamment pour les mineurs).
-- Colonnes nullables, couvertes par les politiques RLS existantes sur `adherents`.

alter table adherents
  add column if not exists licence_expiry      date,
  add column if not exists medical_cert_expiry date;
