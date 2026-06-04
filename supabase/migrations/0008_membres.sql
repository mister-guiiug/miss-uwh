-- Miss UWH — 0008 : enrichit les adhérents en « personnes du club » (espace
-- Adhérents, Lot A). Ajoute les rôles club (joueur/encadrant/arbitre/dirigeant),
-- la date de naissance, le contact et le statut. RLS/audit/Realtime déjà en
-- place sur `adherents` (cf. 0006) ; le trigger d'audit `to_jsonb(new)` capture
-- automatiquement les nouvelles colonnes. Migration idempotente.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum
      ('joueur', 'encadrant', 'arbitre', 'dirigeant');
  end if;
end $$;

alter table adherents
  add column if not exists birth_date   date,
  add column if not exists member_roles member_role[] not null default '{}',
  add column if not exists email        text,
  add column if not exists phone        text,
  add column if not exists status       text not null default 'actif';
