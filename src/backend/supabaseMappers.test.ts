import { describe, expect, it } from 'vitest';
import {
  adherentToUpsertRow,
  attachmentPath,
  customCategoryToUpsertRow,
  entryToRow,
  entryToUpsertRow,
  guardianToUpsertRow,
  recurringToUpsertRow,
  rowToAdherent,
  rowToAttachment,
  rowToCategory,
  rowToGuardian,
  rowToRecurring,
  rowToSeason,
  rowToEntry,
  safeFileName,
  seasonToRow,
  seasonToUpsertRow,
  type AdherentRow,
  type AttachmentRow,
  type CategoryRow,
  type EntryRow,
  type GuardianRow,
  type RecurringRow,
  type SeasonRow,
} from './supabaseMappers.ts';

const entryRow: EntryRow = {
  id: 'e1',
  season_id: 's1',
  category_code: 'R1',
  date: '2025-09-10',
  label: 'HelloAsso inscriptions',
  sens: 'credit',
  amount: '647.00', // numeric Postgres -> string côté client
  method: 'helloasso',
  piece_ref: null,
  invoice_code: 'HelloAsso',
  observation: null,
  reconciled: false,
  event_id: null,
  components: { adulte_plein: 647 },
  created_at: '2025-09-10T08:00:00.000Z',
  created_by: 'u1',
  updated_at: '2025-09-10T08:00:00.000Z',
  updated_by: 'u1',
  deleted_at: null,
  deleted_by: null,
  version: 1,
};

describe('rowToEntry', () => {
  it('convertit snake_case/numeric/dates vers le domaine', () => {
    const e = rowToEntry(entryRow);
    expect(e.seasonId).toBe('s1');
    expect(e.categoryCode).toBe('R1');
    expect(e.amount).toBe(647); // string numeric -> number
    expect(e.invoiceCode).toBe('HelloAsso');
    expect(e.pieceRef).toBeUndefined(); // null -> undefined
    expect(e.deletedAt).toBeUndefined();
    expect(e.createdAt).toBe(Date.parse('2025-09-10T08:00:00.000Z'));
    expect(e.components).toEqual({ adulte_plein: 647 });
    expect(e.attachments).toEqual([]);
  });
});

describe('entryToRow', () => {
  it('ne renvoie que les colonnes insérables, undefined -> null', () => {
    const row = entryToRow(rowToEntry(entryRow));
    expect(row.category_code).toBe('R1');
    expect(row.event_id).toBeNull();
    expect(row.piece_ref).toBeNull();
    expect(row.invoice_code).toBe('HelloAsso');
    expect('created_at' in row).toBe(false); // géré par la BDD
    expect('version' in row).toBe(false);
  });

  it('sérialise deletedAt (epoch) en ISO', () => {
    const e = rowToEntry({
      ...entryRow,
      deleted_at: '2026-01-01T00:00:00.000Z',
    });
    const row = entryToRow(e);
    expect(row.deleted_at).toBe('2026-01-01T00:00:00.000Z');
  });
});

const seasonRow: SeasonRow = {
  id: 's1',
  club_id: 'club-1',
  label: '2025-2026',
  start_date: '2025-05-15',
  end_date: '2026-05-15',
  status: 'cloturee',
  opening_balance: '2364.85',
  closing_balance: '9390.46',
  locked_at: '2026-05-20T10:00:00.000Z',
  reopened_at: null,
  reopen_reason: null,
};

describe('saisons (round-trip)', () => {
  it('rowToSeason convertit montants et dates', () => {
    const s = rowToSeason(seasonRow);
    expect(s.openingBalance).toBe(2364.85);
    expect(s.closingBalance).toBe(9390.46);
    expect(s.status).toBe('cloturee');
    expect(s.lockedAt).toBe(Date.parse('2026-05-20T10:00:00.000Z'));
  });

  it('seasonToRow reconvertit en colonnes', () => {
    const row = seasonToRow(rowToSeason(seasonRow));
    expect(row.opening_balance).toBe(2364.85);
    expect(row.closing_balance).toBe(9390.46);
    expect(row.start_date).toBe('2025-05-15');
    expect(row.reopen_reason).toBeNull();
  });

  it('rowToSeason conserve le clubId, seasonToUpsertRow réinjecte id + club_id', () => {
    const s = rowToSeason(seasonRow);
    expect(s.clubId).toBe('club-1');
    const up = seasonToUpsertRow(s);
    expect(up.id).toBe('s1');
    expect(up.club_id).toBe('club-1');
  });
});

describe('entryToUpsertRow', () => {
  it('inclut l’id pour le on conflict', () => {
    const up = entryToUpsertRow(rowToEntry(entryRow));
    expect(up.id).toBe('e1');
    expect(up.category_code).toBe('R1');
  });
});

describe('récurrences (round-trip)', () => {
  const row: RecurringRow = {
    id: 'r1',
    club_id: 'club-1',
    label: 'Frais bancaires SG',
    category_code: 'D12',
    amount: '14.67', // numeric Postgres -> string
    method: 'prelevement',
  };

  it('rowToRecurring convertit montant et code catégorie', () => {
    const t = rowToRecurring(row);
    expect(t.id).toBe('r1');
    expect(t.categoryCode).toBe('D12');
    expect(t.amount).toBe(14.67);
    expect(t.method).toBe('prelevement');
  });

  it('recurringToUpsertRow réinjecte id + club_id', () => {
    const up = recurringToUpsertRow(rowToRecurring(row), 'club-9');
    expect(up.id).toBe('r1');
    expect(up.club_id).toBe('club-9');
    expect(up.category_code).toBe('D12');
    expect(up.amount).toBe(14.67);
  });
});

describe('adhérents (round-trip)', () => {
  const row: AdherentRow = {
    id: 'a1',
    season_id: 's1',
    first_name: 'Jean',
    last_name: 'Dupont',
    birth_date: '2010-05-01',
    category: 'jeune',
    member_roles: ['joueur', 'encadrant'],
    licence_number: null,
    email: 'jean@example.org',
    phone: null,
    status: 'actif',
    amount: '160.00',
    paid: true,
    notes: null,
  };

  it('rowToAdherent mappe snake_case + null -> undefined + rôles', () => {
    const a = rowToAdherent(row);
    expect(a.seasonId).toBe('s1');
    expect(a.firstName).toBe('Jean');
    expect(a.lastName).toBe('Dupont');
    expect(a.birthDate).toBe('2010-05-01');
    expect(a.category).toBe('jeune');
    expect(a.roles).toEqual(['joueur', 'encadrant']);
    expect(a.email).toBe('jean@example.org');
    expect(a.phone).toBeUndefined();
    expect(a.status).toBe('actif');
    expect(a.amount).toBe(160);
    expect(a.paid).toBe(true);
    expect(a.licenceNumber).toBeUndefined();
    expect(a.notes).toBeUndefined();
  });

  it('adherentToUpsertRow renvoie les colonnes, undefined -> null', () => {
    const up = adherentToUpsertRow(rowToAdherent(row));
    expect(up.id).toBe('a1');
    expect(up.season_id).toBe('s1');
    expect(up.first_name).toBe('Jean');
    expect(up.birth_date).toBe('2010-05-01');
    expect(up.member_roles).toEqual(['joueur', 'encadrant']);
    expect(up.email).toBe('jean@example.org');
    expect(up.phone).toBeNull();
    expect(up.status).toBe('actif');
    expect(up.licence_number).toBeNull();
    expect(up.notes).toBeNull();
    expect(up.paid).toBe(true);
  });

  it('rôles par défaut [] et statut actif quand colonnes vides', () => {
    const a = rowToAdherent({
      ...row,
      member_roles: null,
      status: null,
      birth_date: null,
    });
    expect(a.roles).toEqual([]);
    expect(a.status).toBe('actif');
    expect(a.birthDate).toBeUndefined();
  });
});

describe('tuteurs / familles (round-trip)', () => {
  const row: GuardianRow = {
    id: 'g1',
    member_id: 'a1',
    relation: 'mere',
    name: 'Sophie Dupont',
    phone: '0601020304',
    email: null,
  };

  it('rowToGuardian mappe member_id + null -> undefined', () => {
    const g = rowToGuardian(row);
    expect(g.memberId).toBe('a1');
    expect(g.relation).toBe('mere');
    expect(g.name).toBe('Sophie Dupont');
    expect(g.phone).toBe('0601020304');
    expect(g.email).toBeUndefined();
  });

  it('guardianToUpsertRow réinjecte member_id, undefined -> null', () => {
    const up = guardianToUpsertRow(rowToGuardian(row));
    expect(up.id).toBe('g1');
    expect(up.member_id).toBe('a1');
    expect(up.relation).toBe('mere');
    expect(up.email).toBeNull();
  });
});

describe('catégories personnalisées', () => {
  const row: CategoryRow = {
    code: 'C1',
    label: 'Mécénat local',
    sens: 'recette',
    kind: 'exploitation',
    components: null,
    custom: true,
  };

  it('rowToCategory mappe vers le domaine', () => {
    const c = rowToCategory(row);
    expect(c.code).toBe('C1');
    expect(c.label).toBe('Mécénat local');
    expect(c.sens).toBe('recette');
    expect(c.kind).toBe('exploitation');
    expect(c.components).toBeUndefined();
  });

  it('customCategoryToUpsertRow force custom = true', () => {
    const up = customCategoryToUpsertRow(rowToCategory(row));
    expect(up.code).toBe('C1');
    expect(up.custom).toBe(true);
    expect(up.components).toBeNull();
  });
});

describe('pièces justificatives', () => {
  it('safeFileName assainit le nom', () => {
    expect(safeFileName('Facture FFESSM 2025 (1).pdf')).toBe(
      'Facture_FFESSM_2025_1_.pdf'
    );
    expect(safeFileName('')).toBe('fichier');
  });

  it('attachmentPath construit <entryId>/<attId>-<nom>', () => {
    expect(attachmentPath('e1', 'a1', 'photo 1.jpg')).toBe('e1/a1-photo_1.jpg');
  });

  it('rowToAttachment mappe vers le domaine', () => {
    const row: AttachmentRow = {
      id: 'a1',
      entry_id: 'e1',
      name: 'facture.pdf',
      mime: 'application/pdf',
      size: 1024,
      storage_path: 'e1/a1-facture.pdf',
      uploaded_at: '2026-01-01T00:00:00.000Z',
      uploaded_by: null,
    };
    const a = rowToAttachment(row);
    expect(a.storagePath).toBe('e1/a1-facture.pdf');
    expect(a.size).toBe(1024);
    expect(a.uploadedBy).toBeUndefined();
  });
});
