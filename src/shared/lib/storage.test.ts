import { describe, expect, it } from 'vitest';
import { importData } from './storage.ts';
import { isUuid } from './migrateIds.ts';
import { SCHEMA_VERSION } from './seed.ts';

/** Snapshot v1 hérité (seed v1) : ids courts non-UUID, comme « sea_be775a20 ». */
function legacyV1Snapshot() {
  return {
    version: 1,
    club: { name: 'Clermont Hockey Sub' },
    seasons: [
      {
        id: 'sea_be775a20',
        label: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-08-31',
        status: 'ouverte',
        openingBalance: 2364.85,
      },
    ],
    activeSeasonId: 'sea_be775a20',
    entries: [
      {
        id: 'ec_1',
        seasonId: 'sea_be775a20',
        categoryCode: 'R1',
        date: '2025-09-10',
        label: 'Cotisation',
        sens: 'credit',
        amount: 160,
        attachments: [],
        createdAt: 1,
        updatedAt: 1,
        version: 1,
      },
    ],
    settings: { theme: 'light', decimals: 2, showCompensated: true },
    onboarded: true,
  };
}

describe('importData — migration des ids hérités vers UUID (1 → 2)', () => {
  it('réécrit la saison en UUID, propage aux écritures et monte la version', () => {
    const data = importData(JSON.stringify(legacyV1Snapshot()));

    expect(data.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);

    const seasonId = data.seasons[0]!.id;
    expect(isUuid(seasonId)).toBe(true);
    // La saison active et la clé étrangère des écritures suivent le remappage.
    expect(data.activeSeasonId).toBe(seasonId);
    expect(data.entries[0]!.seasonId).toBe(seasonId);
    expect(isUuid(data.entries[0]!.id)).toBe(true);
  });
});
