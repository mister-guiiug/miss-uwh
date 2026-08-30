/**
 * Contrat de persistance de l'app comptable.
 *
 * Les données d'un club ne se perdent pas : ces tests portent sur des
 * INSTANTANÉS RÉELS des versions antérieures — le jeu de données du club
 * Clermont Hockey Sub (26 écritures, 6 saisons, 2 événements, 2 récurrences,
 * 2 adhérents, journal d'audit), tel que la v1 puis la v2 l'ont écrit dans
 * `miss-uwh:data`. Ils sont écrits AVANT la bascule vers
 * `dev-wpa-config/versioned-store` et doivent passer des deux côtés.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '../types/domain.ts';
import {
  clearData,
  exportData,
  importData,
  loadData,
  saveData,
  STORAGE_KEY,
  unwrapSnapshot,
} from './storage.ts';
import { appDataSchema } from './schema.ts';
import { isUuid } from './migrateIds.ts';
import { createInitialData, SCHEMA_VERSION } from './seed.ts';
import { useToasts } from './toasts.ts';

beforeEach(() => {
  localStorage.clear();
  useToasts.getState().clear();
});

/** Instantané v2 réel : le jeu de données livré, tel que `saveData` l'écrit. */
function realV2Snapshot(): AppData {
  return createInitialData();
}

/** Collections synchronisables et le préfixe d'id que la v1 leur donnait. */
const LEGACY_ID_PREFIXES = {
  seasons: 'sea',
  events: 'ev',
  entries: 'ec',
  recurrings: 'rec',
  adherents: 'adh',
} as const;

/**
 * Instantané v1 réel : le MÊME jeu de données, mais avec les ids courts que la
 * v1 écrivait (« sea_be775a20 », « ec_… ») avant que les entités
 * synchronisables ne passent en UUID (cf. `git show feac1b7^:.../seed.ts`).
 * La substitution porte sur le JSON entier : toute référence — clé étrangère,
 * saison active — suit le renommage, exactement comme dans un vrai snapshot.
 */
function realV1Snapshot(): Record<string, unknown> {
  const data = realV2Snapshot();
  let json = JSON.stringify({ ...data, version: 1 });
  let n = 0;
  for (const [collection, prefix] of Object.entries(LEGACY_ID_PREFIXES)) {
    for (const item of data[collection as keyof typeof LEGACY_ID_PREFIXES]) {
      n += 1;
      json = json.split(item.id).join(`${prefix}_${n.toString(16)}`);
    }
  }
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Instantané v1 minimal saisi à la main, calqué sur un cas réel remonté du
 * terrain : la saison « sea_be775a20 » que Supabase refusait avec « invalid
 * input syntax for type uuid ».
 */
function minimalV1Snapshot() {
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

/** Le total des écritures : un chiffre comptable ne bouge pas d'un centime. */
function totalAmount(data: AppData): number {
  return data.entries.reduce((sum, e) => sum + e.amount, 0);
}

describe('contrat de persistance', () => {
  it('rend le jeu de données initial quand le stockage est vide', () => {
    const data = loadData();
    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.seasons.length).toBeGreaterThan(0);
    expect(data.activeSeasonId).toBeTruthy();
  });

  it('persiste puis relit fidèlement', () => {
    const data = realV2Snapshot();
    data.club.name = 'Clermont Hockey Sub — test';
    saveData(data);

    const reread = loadData();
    expect(reread.club.name).toBe('Clermont Hockey Sub — test');
    expect(reread.entries).toHaveLength(data.entries.length);
    expect(totalAmount(reread)).toBeCloseTo(totalAmount(data), 2);
  });

  it('clearData efface l’instantané sans toucher aux autres clés du domaine', () => {
    saveData(realV2Snapshot());
    localStorage.setItem('miss-uwh:theme', 'dark');
    localStorage.setItem('miss-uwh:syncqueue', '[]');

    clearData();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('miss-uwh:theme')).toBe('dark');
    expect(localStorage.getItem('miss-uwh:syncqueue')).toBe('[]');
  });

  it('prévient l’utilisateur et repart du seed si le contenu stocké est invalide', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":2,"oops":true}');

    const data = loadData();

    expect(data.seasons.length).toBeGreaterThan(0); // repli propre
    const toasts = useToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe('error');
    expect(toasts[0]!.message).toMatch(/illisibles/);
  });

  it('rejette un JSON importé qui n’est pas un instantané Miss UWH', () => {
    expect(() => importData('{"foo":1}')).toThrow();
  });
});

/**
 * INVARIANT 1 — DONNÉES EN PLACE. Un instantané déjà écrit sur l'appareil du
 * trésorier se relit sans transformation ni perte, quelle que soit sa version.
 */
describe('invariant 1 — les données déjà en place', () => {
  it('relit un instantané v2 réel à l’identique (aucune transformation)', () => {
    const snapshot = realV2Snapshot();
    // Format écrit par l'app : la donnée NUE, version interne comprise.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    const data = loadData();

    expect(data).toEqual(snapshot);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('relit deux fois de suite le même instantané v2 (chargement stable)', () => {
    const snapshot = realV2Snapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    expect(loadData()).toEqual(snapshot);
    expect(loadData()).toEqual(snapshot);
  });

  it('migre un instantané v1 réel vers la v2 sans perdre une écriture', () => {
    const v1 = realV1Snapshot();
    const reference = realV2Snapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));

    const data = loadData();

    expect(data.version).toBe(SCHEMA_VERSION);
    // Rien ne disparaît : même volume, mêmes montants, même solde d'ouverture.
    expect(data.entries).toHaveLength(reference.entries.length);
    expect(data.seasons).toHaveLength(reference.seasons.length);
    expect(data.adherents).toHaveLength(reference.adherents.length);
    expect(data.audit).toHaveLength(reference.audit.length);
    expect(totalAmount(data)).toBeCloseTo(totalAmount(reference), 2);
    expect(data.club.name).toBe(reference.club.name);

    // Les ids synchronisables sont désormais des UUID, et les références suivent.
    const active = data.seasons.find(s => s.id === data.activeSeasonId);
    expect(active).toBeDefined();
    expect(isUuid(data.activeSeasonId)).toBe(true);
    for (const entry of data.entries) {
      expect(isUuid(entry.id)).toBe(true);
      expect(data.seasons.some(s => s.id === entry.seasonId)).toBe(true);
    }
    for (const entry of data.entries.filter(e => e.eventId)) {
      expect(data.events.some(ev => ev.id === entry.eventId)).toBe(true);
    }
  });

  it('migre l’instantané v1 minimal du terrain (sea_be775a20 → UUID)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalV1Snapshot()));

    const data = loadData();

    expect(data.version).toBe(SCHEMA_VERSION);
    const seasonId = data.seasons[0]!.id;
    expect(isUuid(seasonId)).toBe(true);
    expect(data.activeSeasonId).toBe(seasonId);
    expect(data.entries[0]!.seasonId).toBe(seasonId);
    expect(isUuid(data.entries[0]!.id)).toBe(true);
    // La donnée métier, elle, ne bouge pas.
    expect(data.entries[0]!.amount).toBe(160);
    expect(data.entries[0]!.label).toBe('Cotisation');
    expect(data.seasons[0]!.openingBalance).toBe(2364.85);
  });

  it('monte un instantané pré-versionné (sans champ `version`)', () => {
    const raw = realV1Snapshot();
    delete raw['version'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const data = loadData();

    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.entries).toHaveLength(realV2Snapshot().entries.length);
    expect(isUuid(data.activeSeasonId)).toBe(true);
  });
});

/**
 * INVARIANT 2 — EXPORTS. Le fichier téléchargé reste la donnée NUE, lisible par
 * une version antérieure de l'app ; l'import accepte tout ce qui a déjà pu être
 * téléchargé.
 */
describe('invariant 2 — les fichiers d’export', () => {
  it('exporte la donnée NUE, encore relisible par l’ancienne app', () => {
    const data = realV2Snapshot();
    const parsed = JSON.parse(exportData(data)) as Record<string, unknown>;

    // Pas d'enveloppe : l'ancien `importData` faisait `runMigrations(parse)`
    // puis `appDataSchema.safeParse` — les deux passent sur ce fichier.
    expect(parsed['v']).toBeUndefined();
    expect(parsed['version']).toBe(SCHEMA_VERSION);
    expect(appDataSchema.safeParse(parsed).success).toBe(true);
    expect(parsed).toEqual(JSON.parse(JSON.stringify(data)));
  });

  it('ré-importe son propre export sans perte', () => {
    const data = realV2Snapshot();

    const reimported = importData(exportData(data));

    expect(reimported).toEqual(data);
    expect(totalAmount(reimported)).toBeCloseTo(totalAmount(data), 2);
  });

  it('importe un ancien fichier d’export (nu, v1) et le migre', () => {
    const file = JSON.stringify(realV1Snapshot(), null, 2);

    const data = importData(file);

    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.entries).toHaveLength(realV2Snapshot().entries.length);
    expect(isUuid(data.entries[0]!.id)).toBe(true);
  });
});

/**
 * INVARIANT 3 — CONTRAT. Cinq fonctions, mêmes signatures : le store zustand et
 * l'écran Réglages ne voient rien de la bascule.
 */
describe('invariant 3 — le contrat du module', () => {
  it('expose les cinq fonctions attendues par le store et les Réglages', () => {
    for (const fn of [loadData, saveData, clearData, exportData, importData]) {
      expect(typeof fn).toBe('function');
    }
    expect(loadData).toHaveLength(0);
    expect(saveData).toHaveLength(1);
    expect(clearData).toHaveLength(0);
    expect(exportData).toHaveLength(1);
    expect(importData).toHaveLength(1);
    expect(STORAGE_KEY).toBe('miss-uwh:data');
  });

  it('boucle complète store → export → import → store', () => {
    const data = realV2Snapshot();
    data.club.treasurer = 'Trésorier 2026';
    saveData(data); // ce que fait `persist()` du store

    const file = exportData(loadData()); // ce que fait l'écran Réglages
    const restored = importData(file); // …puis `replaceData(importData(...))`

    expect(restored.club.treasurer).toBe('Trésorier 2026');
    expect(totalAmount(restored)).toBeCloseTo(totalAmount(data), 2);
  });
});

/**
 * CE QUE LA BASCULE AJOUTE. Le filet que le `runMigrations` maison n'avait pas :
 * une copie de côté avant toute perte possible, une migration écrite une fois
 * pour toutes, et aucune destruction silencieuse.
 */
describe('apport du magasin versionné du socle', () => {
  const BACKUP_V0 = `${STORAGE_KEY}.backup-v0`;

  it('copie l’instantané de côté AVANT de le migrer, et n’y revient pas', () => {
    const raw = JSON.stringify(realV1Snapshot());
    localStorage.setItem(STORAGE_KEY, raw);

    const migrated = loadData();

    // L'original intact, à côté — la migration réécrit des ids, on garde la trace.
    expect(localStorage.getItem(BACKUP_V0)).toBe(raw);
    // La migration est PERSISTÉE : la clé principale porte l'enveloppe du socle…
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      v: number;
      data: AppData;
    };
    expect(stored.v).toBe(SCHEMA_VERSION);
    expect(stored.data.version).toBe(SCHEMA_VERSION);
    // …donc le chargement suivant ne rejoue rien : les UUID tirés au sort par la
    // migration ne changent plus d'un démarrage à l'autre.
    expect(loadData().seasons.map(s => s.id)).toEqual(
      migrated.seasons.map(s => s.id)
    );
  });

  it('met de côté une enveloppe de version inconnue au lieu de l’écraser', () => {
    const fromFuture = JSON.stringify({ v: 99, data: { club: 'demain' } });
    localStorage.setItem(STORAGE_KEY, fromFuture);

    const data = loadData();

    expect(data.seasons.length).toBeGreaterThan(0); // repli sur le seed
    expect(localStorage.getItem(STORAGE_KEY)).toBe(fromFuture); // rien d'écrasé
    expect(localStorage.getItem(`${STORAGE_KEY}.backup-v99`)).toBe(fromFuture);
    // …et l'import du même fichier se REFUSE, avec un message exploitable.
    expect(() => importData(fromFuture)).toThrow(/version 99/);
  });

  it('met de côté un instantané illisible plutôt que de le perdre', () => {
    localStorage.setItem(STORAGE_KEY, '{"club": tronqué');

    expect(loadData().seasons.length).toBeGreaterThan(0);
    expect(localStorage.getItem(`${STORAGE_KEY}.backup-illisible`)).toBe(
      '{"club": tronqué'
    );
  });

  it('importe aussi une enveloppe du socle ({ v, data })', () => {
    const data = realV2Snapshot();

    const imported = importData(JSON.stringify({ v: SCHEMA_VERSION, data }));

    expect(imported).toEqual(data);
  });

  it('un import refusé laisse l’état exactement comme avant', () => {
    const data = realV2Snapshot();
    saveData(data);
    const before = localStorage.getItem(STORAGE_KEY);

    expect(() => importData('{"foo":1}')).toThrow();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    // Et pas de toast « données locales illisibles » : rien n'a été réinitialisé,
    // c'est l'écran Réglages qui rend compte de son propre import.
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('clearData emporte aussi les copies de côté', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(realV1Snapshot()));
    loadData(); // crée `…data.backup-v0`
    expect(localStorage.getItem(BACKUP_V0)).not.toBeNull();

    clearData();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(BACKUP_V0)).toBeNull();
  });

  it('l’export de secours de l’ErrorBoundary reste de la donnée NUE', () => {
    const data = realV2Snapshot();
    saveData(data); // écrit l'enveloppe { v, data }

    // Ce que fait `downloadBackup()` : lecture brute, sans React ni zod.
    const file = unwrapSnapshot(localStorage.getItem(STORAGE_KEY)!);
    const parsed = JSON.parse(file) as Record<string, unknown>;

    expect(parsed['v']).toBeUndefined();
    expect(parsed['version']).toBe(SCHEMA_VERSION);
    expect(appDataSchema.safeParse(parsed).success).toBe(true);
    expect(importData(file)).toEqual(data);
  });

  it('unwrapSnapshot rend l’original devant un instantané nu ou illisible', () => {
    const nu = JSON.stringify(realV2Snapshot());
    expect(unwrapSnapshot(nu)).toBe(nu);
    expect(unwrapSnapshot('{ tronqué')).toBe('{ tronqué');
  });
});
