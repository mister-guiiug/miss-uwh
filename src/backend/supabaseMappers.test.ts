import { describe, expect, it } from 'vitest';
import {
  attachmentPath,
  entryToRow,
  entryToUpsertRow,
  rowToAttachment,
  rowToSeason,
  rowToEntry,
  safeFileName,
  seasonToRow,
  seasonToUpsertRow,
  type AttachmentRow,
  type EntryRow,
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
