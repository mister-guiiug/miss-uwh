/**
 * LA CONCURRENCE OPTIMISTE, DE BOUT EN BOUT CÔTÉ CLIENT — contre un serveur
 * SIMULÉ. Tout est réel sauf le client Supabase : le store (en mode
 * Supabase), le bus, la file du socle, le transport, le repository et ses
 * mappers. Le faux client tient une table `entries` et une RPC
 * `update_entry_checked` qui rend ce que rend la vraie (0020 + 0021) :
 * 42501 pour une ligne hors droits, 40001 pour une version périmée, la
 * nouvelle version sinon, avec les deux sémantiques de colonnes de 0021.
 *
 * Ce que la RPC fait VRAIMENT est tenu côté base par les pgTAP
 * (`supabase/tests/occ-*.test.sql`) ; ce fichier tient ce que le client en
 * fait : la version qu'il envoie, ce qu'il envoie, et ce qu'il fait d'un refus.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryRow } from './supabaseMappers.ts';
import type { JournalEntry } from '../shared/types/domain.ts';

// Le mode est épinglé : le store n'émet vers le serveur qu'en mode Supabase.
vi.mock('./config.ts', () => ({ BACKEND: 'supabase', IS_SUPABASE: true }));

type Patch = Record<string, unknown>;

interface RpcCall {
  p_id: string;
  p_expected_version: number;
  p_patch: Patch;
}

/** Le serveur simulé — partagé avec la fabrique du faux client (hoisting). */
const server = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  /** Écritures hors des droits de l'utilisateur (RLS). */
  denied: new Set<string>(),
  rpcCalls: [] as Array<{
    p_id: string;
    p_expected_version: number;
    p_patch: Record<string, unknown>;
  }>,
  upserts: [] as Array<Record<string, unknown>>,
  /** Retient la réponse de la RPC : une modification « en vol ». */
  hold: null as Promise<void> | null,
  /** Juste avant qu'une lecture d'écriture réponde (un autre écrit). */
  beforeRead: null as ((id: string) => void) | null,
}));

vi.mock('../lib/supabase.ts', () => {
  const NOT_NULL = [
    'label',
    'amount',
    'category_code',
    'date',
    'sens',
    'method',
    'reconciled',
  ];
  const NULLABLE = [
    'observation',
    'piece_ref',
    'invoice_code',
    'event_id',
    'components',
    'deleted_at',
  ];

  /** Un constructeur de requête minimal : `select/eq/order/limit`, puis `await`. */
  function query(table: string) {
    let id: unknown;
    const rows = () =>
      table === 'entries' ? [...server.rows.values()].map(r => ({ ...r })) : [];
    const builder = {
      select: () => builder,
      eq: (_column: string, value: unknown) => {
        id = value;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => {
        server.beforeRead?.(String(id));
        const row = server.rows.get(String(id));
        return { data: row ? { ...row } : null, error: null };
      },
      upsert: async (row: Record<string, unknown>) => {
        server.upserts.push(row);
        const existing = server.rows.get(String(row.id));
        if (existing) {
          Object.assign(existing, row);
          existing.version = Number(existing.version) + 1;
        } else {
          server.rows.set(String(row.id), { ...row, version: 1 });
        }
        return { data: null, error: null };
      },
      then: (
        resolve: (value: { data: unknown[]; error: null }) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (table: string) => query(table),
    rpc: async (name: string, args: RpcCall) => {
      server.rpcCalls.push(args);
      if (server.hold) await server.hold;
      if (name !== 'update_entry_checked')
        return { data: null, error: { code: 'PGRST202', message: name } };
      const row = server.rows.get(args.p_id);
      if (!row || server.denied.has(args.p_id))
        return {
          data: null,
          error: {
            code: '42501',
            message: `Écriture ${args.p_id} introuvable, ou droits insuffisants pour la modifier.`,
          },
        };
      if (row.version !== args.p_expected_version)
        return {
          data: null,
          error: {
            code: '40001',
            message: `Conflit de version sur l'écriture ${args.p_id} (rechargez).`,
          },
        };
      for (const column of NOT_NULL)
        if (args.p_patch[column] != null) row[column] = args.p_patch[column];
      for (const column of NULLABLE)
        if (column in args.p_patch) row[column] = args.p_patch[column];
      row.version = Number(row.version) + 1;
      return { data: row.version, error: null };
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: async () => 'ok',
  };

  return { getSupabase: async () => client };
});

import { useAppStore } from '../store/useAppStore.ts';
import { useToasts } from '../shared/lib/toasts.ts';
import { entryRejectionOf } from './entryPatch.ts';
import {
  clearAll,
  deadEntryUpdate,
  deadItems,
  getSyncQueue,
} from './syncQueue.ts';
import {
  drain,
  keepServerVersion,
  reapplyMyChange,
  retryDeadOps,
  startSync,
  stopSync,
} from './sync.ts';

const store = () => useAppStore.getState();
const local = (id: string) => store().data.entries.find(e => e.id === id);
const messages = () => useToasts.getState().toasts.map(t => t.message);

let online = true;

/** Une écriture présente À L'IDENTIQUE sur le serveur et sur l'appareil. */
function seed(over: Partial<JournalEntry> = {}): JournalEntry {
  const entry: JournalEntry = {
    id: 'e1',
    seasonId: store().data.activeSeasonId,
    categoryCode: 'R1',
    date: '2025-09-10',
    label: 'Cotisations',
    sens: 'credit',
    amount: 640,
    method: 'cheque',
    observation: 'Chèques remis',
    attachments: [],
    createdAt: 1,
    updatedAt: 1,
    version: 1,
    ...over,
  };
  const row: EntryRow = {
    id: entry.id,
    season_id: entry.seasonId,
    category_code: entry.categoryCode,
    date: entry.date,
    label: entry.label,
    sens: entry.sens,
    amount: entry.amount,
    method: entry.method,
    piece_ref: entry.pieceRef ?? null,
    invoice_code: entry.invoiceCode ?? null,
    observation: entry.observation ?? null,
    reconciled: entry.reconciled ?? false,
    event_id: entry.eventId ?? null,
    components: entry.components ?? null,
    created_at: '2025-09-10T00:00:00.000Z',
    created_by: null,
    updated_at: '2025-09-10T00:00:00.000Z',
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    version: entry.version,
  };
  server.rows.set(entry.id, { ...row });
  store().hydrateEntry(entry.id, entry);
  return entry;
}

/** Un autre trésorier modifie l'écriture sur le serveur. */
function someoneElseWrites(id: string, patch: Patch): void {
  const row = server.rows.get(id)!;
  Object.assign(row, patch);
  row.version = Number(row.version) + 1;
}

/** La file s'est vidée (le drain est lancé sans être attendu par le store). */
async function settled(): Promise<void> {
  await vi.waitFor(() => expect(getSyncQueue().pending()).toBe(0));
}

beforeEach(() => {
  online = true;
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
  localStorage.setItem('uwh_locale', 'fr');
  server.rows.clear();
  server.denied.clear();
  server.rpcCalls.length = 0;
  server.upserts.length = 0;
  server.hold = null;
  server.beforeRead = null;
  clearAll();
  useToasts.getState().clear();
  store().resetAll('Club test', '2025-2026', 0);
  startSync();
});

afterEach(() => {
  stopSync();
  clearAll();
  Reflect.deleteProperty(window.navigator, 'onLine');
  localStorage.clear();
});

describe('une modification part par update_entry_checked, avec la version vue', () => {
  it('pas par un upsert — et la version locale devient celle du serveur', async () => {
    seed();

    store().updateEntry('e1', { label: 'Cotisations de septembre' });
    await settled();

    expect(server.upserts).toHaveLength(0);
    expect(server.rpcCalls).toEqual([
      {
        p_id: 'e1',
        p_expected_version: 1,
        p_patch: { label: 'Cotisations de septembre' },
      },
    ]);
    expect(server.rows.get('e1')).toMatchObject({
      label: 'Cotisations de septembre',
      version: 2,
    });
    expect(local('e1')?.version).toBe(2);
    expect(deadItems()).toHaveLength(0);
  });

  it('en mode Supabase, la modification locale ne s’invente pas de version', () => {
    online = false;
    seed({ version: 7 });

    store().updateEntry('e1', { amount: 700 });

    // C'est la version VUE : elle part comme version attendue.
    expect(local('e1')?.version).toBe(7);
    expect(getSyncQueue().list()[0]?.payload).toMatchObject({
      kind: 'entry.update',
      expectedVersion: 7,
    });
  });

  it('ne porte que ce qui a changé, et un champ vidé part à null', async () => {
    seed();

    store().updateEntry('e1', { observation: undefined, method: 'virement' });
    await settled();

    expect(server.rpcCalls[0]?.p_patch).toEqual({
      observation: null,
      method: 'virement',
    });
    expect(server.rows.get('e1')).toMatchObject({
      observation: null,
      method: 'virement',
      label: 'Cotisations',
    });
  });

  it('pointage, suppression logique et restauration passent aussi par la RPC', async () => {
    seed();

    store().setReconciled('e1', true);
    await settled();
    store().softDeleteEntry('e1', 'doublon');
    await settled();
    store().restoreEntry('e1');
    await settled();

    expect(server.rpcCalls.map(c => c.p_expected_version)).toEqual([1, 2, 3]);
    expect(server.rpcCalls[0]?.p_patch).toEqual({ reconciled: true });
    expect(server.rpcCalls[1]?.p_patch).toMatchObject({
      observation: 'Chèques remis — Suppression : doublon',
    });
    expect(server.rpcCalls[1]?.p_patch.deleted_at).toEqual(expect.any(String));
    expect(server.rpcCalls[2]?.p_patch).toEqual({ deleted_at: null });
    expect(server.upserts).toHaveLength(0);
    expect(local('e1')?.version).toBe(4);
  });

  it('une création reste un upsert, et la modification faite avant son envoi part APRÈS elle', async () => {
    online = false;
    const id = store().addEntry({
      seasonId: store().data.activeSeasonId,
      categoryCode: 'D8',
      date: '2025-10-05',
      label: 'Goûter',
      sens: 'debit',
      amount: 30,
      method: 'especes',
    })!;
    store().updateEntry(id, { label: 'Goûter des jeunes' });

    // Deux clés : la modification n'a pas remplacé la création en attente.
    expect(
      getSyncQueue()
        .list()
        .map(i => i.payload.kind)
    ).toEqual(['entry.upsert', 'entry.update']);

    online = true;
    await drain();

    expect(server.upserts).toHaveLength(1);
    expect(server.rpcCalls[0]).toMatchObject({
      p_id: id,
      p_expected_version: 1,
      p_patch: { label: 'Goûter des jeunes' },
    });
    expect(server.rows.get(id)).toMatchObject({
      label: 'Goûter des jeunes',
      version: 2,
    });
    expect(local(id)?.version).toBe(2);
  });

  it('hors ligne, deux modifications de la même écriture font UN envoi, avec les deux champs', async () => {
    online = false;
    seed();

    store().updateEntry('e1', { label: 'Libellé corrigé' });
    store().updateEntry('e1', { amount: 660 });
    expect(getSyncQueue().pending()).toBe(1);

    online = true;
    await drain();

    expect(server.rpcCalls).toEqual([
      {
        p_id: 'e1',
        p_expected_version: 1,
        p_patch: { label: 'Libellé corrigé', amount: 660 },
      },
    ]);
    expect(server.rows.get('e1')).toMatchObject({
      label: 'Libellé corrigé',
      amount: 660,
      version: 2,
    });
  });

  it('une modification faite PENDANT l’envoi repart avec la NOUVELLE version', async () => {
    seed();
    let release!: () => void;
    server.hold = new Promise<void>(resolve => (release = resolve));

    store().updateEntry('e1', { label: 'Premier envoi' });
    await vi.waitFor(() => expect(server.rpcCalls).toHaveLength(1));
    // La première est en vol : la seconde, faite sur cet appareil, part de
    // la même version vue (1) et contient la première.
    store().updateEntry('e1', { amount: 700 });
    server.hold = null;
    release();
    await settled();

    // Sans la reprise de version, notre propre envoi lui aurait été opposé
    // en conflit (le serveur est passé en 2 par NOTRE fait).
    expect(server.rpcCalls.map(c => c.p_expected_version)).toEqual([1, 2]);
    expect(server.rpcCalls[1]?.p_patch).toEqual({
      label: 'Premier envoi',
      amount: 700,
    });
    expect(deadItems()).toHaveLength(0);
    expect(local('e1')?.version).toBe(3);
  });

  it('la modification suivante part avec la version rendue par le serveur', async () => {
    seed();

    store().updateEntry('e1', { label: 'Un' });
    await settled();
    store().updateEntry('e1', { label: 'Deux' });
    await settled();

    expect(server.rpcCalls.map(c => c.p_expected_version)).toEqual([1, 2]);
    expect(server.rows.get('e1')?.version).toBe(3);
    expect(local('e1')?.version).toBe(3);
  });
});

describe('conflit (40001) : rien n’est écrasé', () => {
  async function conflit() {
    seed();
    someoneElseWrites('e1', { amount: 700, observation: 'Corrigé par Bob' });
    store().updateEntry('e1', { label: 'Ma version' });
    await settled();
  }

  it('l’opération rejoint les refusées, avec la raison « modifiée ailleurs »', async () => {
    await conflit();

    expect(server.rows.get('e1')).toMatchObject({
      label: 'Cotisations',
      amount: 700,
      version: 2,
    });
    expect(deadItems()).toHaveLength(1);
    expect(entryRejectionOf(deadEntryUpdate('e1')?.lastError)).toBe('conflict');
    expect(messages().join(' ')).toMatch(/modifiée ailleurs/);
    expect(store().syncStatus.state).toBe('error');
    // Sur l'appareil, la modification reste visible : rien n'est perdu.
    expect(local('e1')?.label).toBe('Ma version');
  });

  it('« Garder la version du serveur » relit l’écriture et abandonne ma modification', async () => {
    await conflit();

    await expect(keepServerVersion('e1')).resolves.toBe('done');

    expect(local('e1')).toMatchObject({
      label: 'Cotisations',
      amount: 700,
      observation: 'Corrigé par Bob',
      version: 2,
    });
    expect(deadItems()).toHaveLength(0);
    expect(getSyncQueue().pending()).toBe(0);
    expect(store().syncStatus.state).toBe('ready');
    // Aucune écriture de plus côté serveur.
    expect(server.rpcCalls).toHaveLength(1);
  });

  it('« Réappliquer ma modification » relit la version du serveur, puis rappelle la RPC avec elle — MES champs seulement', async () => {
    await conflit();

    await expect(reapplyMyChange('e1')).resolves.toBe('done');

    expect(server.rpcCalls.at(-1)).toEqual({
      p_id: 'e1',
      p_expected_version: 2,
      p_patch: { label: 'Ma version' },
    });
    // Les champs de Bob sont intacts : c'est un diff, pas une copie entière.
    expect(server.rows.get('e1')).toMatchObject({
      label: 'Ma version',
      amount: 700,
      observation: 'Corrigé par Bob',
      version: 3,
    });
    expect(local('e1')).toMatchObject({
      label: 'Ma version',
      amount: 700,
      version: 3,
    });
    expect(deadItems()).toHaveLength(0);
  });

  it('« Réappliquer » reste prudent si l’écriture rebouge entre la lecture et l’envoi', async () => {
    await conflit();
    server.beforeRead = id => {
      // La lecture répond la v2 ; aussitôt après, un autre passe la v3.
      server.beforeRead = null;
      queueMicrotask(() => someoneElseWrites(id, { amount: 800 }));
    };

    await expect(reapplyMyChange('e1')).resolves.toBe('conflict');

    expect(server.rows.get('e1')).toMatchObject({
      label: 'Cotisations',
      amount: 800,
    });
    expect(entryRejectionOf(deadEntryUpdate('e1')?.lastError)).toBe('conflict');
  });

  it('« Réappliquer » d’une écriture qui n’existe plus : rien ne part', async () => {
    await conflit();
    server.rows.delete('e1');

    await expect(reapplyMyChange('e1')).resolves.toBe('gone');

    expect(server.rpcCalls).toHaveLength(1);
    expect(deadItems()).toHaveLength(1); // le choix reste à faire
  });

  it('hors ligne, un geste de récupération ne retire rien', async () => {
    await conflit();
    server.beforeRead = () => {
      throw new Error('Failed to fetch');
    };

    await expect(keepServerVersion('e1')).rejects.toThrow(/fetch/);

    expect(deadItems()).toHaveLength(1);
    expect(local('e1')?.label).toBe('Ma version');
  });

  it('« Réessayer » ne renvoie pas un conflit : il attend une décision', async () => {
    await conflit();

    await retryDeadOps();

    expect(server.rpcCalls).toHaveLength(1);
    expect(deadItems()).toHaveLength(1);
  });
});

describe('refus de droits (42501)', () => {
  it('même récupération, avec un message sur les droits', async () => {
    seed();
    server.denied.add('e1');

    store().updateEntry('e1', { label: 'Pas le droit' });
    await settled();

    expect(entryRejectionOf(deadEntryUpdate('e1')?.lastError)).toBe(
      'forbidden'
    );
    expect(messages().join(' ')).toMatch(/droits/);
    expect(server.rows.get('e1')?.label).toBe('Cotisations');

    await expect(keepServerVersion('e1')).resolves.toBe('done');
    expect(local('e1')?.label).toBe('Cotisations');
    expect(deadItems()).toHaveLength(0);
  });

  it('« Réappliquer » après un changement de rôle repart de la version ACTUELLE du serveur', async () => {
    seed();
    server.denied.add('e1');
    store().updateEntry('e1', { label: 'Après changement de rôle' });
    await settled();
    // Entre-temps, un autre a modifié l'écriture, et le rôle a changé.
    someoneElseWrites('e1', { amount: 700 });
    server.denied.delete('e1');

    await expect(reapplyMyChange('e1')).resolves.toBe('done');

    expect(server.rpcCalls.at(-1)).toMatchObject({
      p_expected_version: 2,
      p_patch: { label: 'Après changement de rôle' },
    });
    expect(server.rows.get('e1')).toMatchObject({
      label: 'Après changement de rôle',
      amount: 700,
      version: 3,
    });
    expect(deadItems()).toHaveLength(0);
  });

  it('« Réappliquer » toujours hors droits le dit, sans rien écraser', async () => {
    seed();
    server.denied.add('e1');
    store().updateEntry('e1', { label: 'Pas le droit' });
    await settled();

    await expect(reapplyMyChange('e1')).resolves.toBe('forbidden');

    expect(server.rows.get('e1')?.label).toBe('Cotisations');
    expect(entryRejectionOf(deadEntryUpdate('e1')?.lastError)).toBe(
      'forbidden'
    );
  });

  it('« Réessayer » relance un refus de droits (un rôle a pu changer)', async () => {
    seed();
    server.denied.add('e1');
    store().updateEntry('e1', { label: 'Après changement de rôle' });
    await settled();
    server.denied.delete('e1');

    await retryDeadOps();

    expect(server.rows.get('e1')).toMatchObject({
      label: 'Après changement de rôle',
      version: 2,
    });
    expect(deadItems()).toHaveLength(0);
  });
});
