-- Miss UWH — 0007 : nouveaux rôles d'accès pour les espaces (« Lens »).
--   secretaire → espace Adhérents ; entraineur → espace Entraînements.
-- PG15 autorise `add value` dans une transaction tant que la valeur n'est pas
-- utilisée dans la même transaction (cas ici). Idempotent via `if not exists`.
alter type app_role add value if not exists 'secretaire';
alter type app_role add value if not exists 'entraineur';
