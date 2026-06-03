-- Miss UWH — 0004 : pointage / rapprochement bancaire.
-- Une écriture rapprochée a été retrouvée sur le relevé de banque.

alter table entries
  add column if not exists reconciled boolean not null default false;

create index if not exists entries_reconciled_idx
  on entries (season_id, reconciled);
