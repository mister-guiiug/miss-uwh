/**
 * Tests du GLUE applicatif autour de la file du socle : clé d'entité,
 * classification des erreurs et migration de l'ancien format d'entrées.
 * La mécanique de file (enfilage, drain, backoff, lettres mortes, fusion)
 * appartient au socle (`@mister-guiiug/dev-pwa-config/sync-queue`) et y est
 * testée ; elle n'est plus re-testée ici.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RemoteOp } from './syncBus.ts';
import { EntryWriteRejected, type EntryUpdateOp } from './entryPatch.ts';
import {
  clearAll,
  consolidateDeadEntryUpdates,
  deadEntryUpdate,
  deadItems,
  entityKey,
  getSyncQueue,
  isTransient,
  migrateLegacyItems,
  pendingEntryUpdates,
  rebaseEntryUpdates,
  requeueRetryable,
  setQueueObserver,
  setQueueTransport,
  takeEntryUpdates,
  withPendingPatch,
  type QueueItem,
} from './syncQueue.ts';

const QUEUE_KEY = 'miss-uwh:syncqueue';
const DEAD_KEY = 'miss-uwh:syncdead';

/**
 * Une opération dont SEULE l'identité est renseignée.
 *
 * `entityKey` ne lit rien d'autre. Remplir un `Adherent` ou une `Season`
 * complets n'ajouterait aucune assertion, et ferait tomber ce test le jour où
 * un champ obligatoire entre dans le domaine — sans qu'aucune clé ait bougé.
 * D'où l'unique conversion du fichier, cantonnée ici.
 */
function op(
  kind: RemoteOp['kind'],
  porteur: Record<string, unknown>
): RemoteOp {
  return { kind, ...porteur } as unknown as RemoteOp;
}

/**
 * Les trente-trois opérations du bus et la clé attendue de chacune.
 *
 * Toutes portent le MÊME identifiant `x` : c'est ce qui rend lisibles les deux
 * invariants éprouvés plus bas — un `upsert` et son `delete` doivent retomber
 * sur la même clé (pour fusionner), et deux entités différentes ne doivent
 * jamais y retomber (sous peine de fusionner ce qui n'a rien à voir). Avec des
 * identifiants distincts, les deux passeraient par accident.
 *
 * Le tableau existe parce que la couverture disait la vérité : vingt-six de
 * ces trente-deux bras n'étaient exercés par rien. Une faute de frappe dans
 * l'un d'eux ne casse aucun type — `referee:${op.id}` copié en `album:${op.id}`
 * compile parfaitement — et ne se voit qu'à la perte de données.
 */
const CAS: ReadonlyArray<readonly [RemoteOp, string | null]> = [
  [op('entry.upsert', { entry: { id: 'x' } }), 'entry:x'],
  // La modification a SA clé : elle ne doit jamais remplacer, dans la file,
  // la création encore en attente de la même écriture.
  [op('entry.update', { id: 'x' }), 'entry.update:x'],
  [op('entry.bulkUpsert', { entries: [] }), null],
  [op('season.upsert', { season: { id: 'x' } }), 'season:x'],
  [op('season.close', { id: 'x' }), null],
  [op('season.reopen', { id: 'x', reason: 'erreur' }), null],
  [op('event.upsert', { event: { id: 'x' } }), 'event:x'],
  [op('event.delete', { id: 'x' }), 'event:x'],
  [op('recurring.upsert', { recurring: { id: 'x' } }), 'recurring:x'],
  [op('recurring.delete', { id: 'x' }), 'recurring:x'],
  [op('adherent.upsert', { adherent: { id: 'x' } }), 'adherent:x'],
  [op('adherent.delete', { id: 'x' }), 'adherent:x'],
  [op('guardian.upsert', { guardian: { id: 'x' } }), 'guardian:x'],
  [op('guardian.delete', { id: 'x' }), 'guardian:x'],
  [op('clubevent.upsert', { clubEvent: { id: 'x' } }), 'clubevent:x'],
  [op('clubevent.delete', { id: 'x' }), 'clubevent:x'],
  [op('announcement.upsert', { announcement: { id: 'x' } }), 'announcement:x'],
  [op('announcement.delete', { id: 'x' }), 'announcement:x'],
  [op('tournament.upsert', { tournament: { id: 'x' } }), 'tournament:x'],
  [op('tournament.delete', { id: 'x' }), 'tournament:x'],
  [op('session.upsert', { session: { id: 'x' } }), 'session:x'],
  [op('session.delete', { id: 'x' }), 'session:x'],
  [op('exercise.upsert', { exercise: { id: 'x' } }), 'exercise:x'],
  [op('exercise.delete', { id: 'x' }), 'exercise:x'],
  [op('strategy.upsert', { strategy: { id: 'x' } }), 'strategy:x'],
  [op('strategy.delete', { id: 'x' }), 'strategy:x'],
  [op('referee.upsert', { referee: { id: 'x' } }), 'referee:x'],
  [op('referee.delete', { id: 'x' }), 'referee:x'],
  [op('album.upsert', { album: { id: 'x' } }), 'album:x'],
  [op('album.delete', { id: 'x' }), 'album:x'],
  // Seule entité identifiée par un `code` et non un `id`, des deux côtés.
  [op('category.upsert', { category: { code: 'x' } }), 'category:x'],
  [op('category.delete', { code: 'x' }), 'category:x'],
  [op('aiconfig.upsert', { config: { sharedSkills: 's' } }), 'aiconfig'],
];

describe('entityKey', () => {
  it.each(
    CAS.map(([operation, cle]) => ({ kind: operation.kind, operation, cle }))
  )('$kind → $cle', ({ operation, cle }) => {
    expect(entityKey(operation)).toBe(cle);
  });

  it('un upsert et le delete de la même entité partagent la clé', () => {
    // Sans quoi la suppression ne fusionnerait pas avec la modification
    // qu'elle annule : les deux partiraient, dans cet ordre, et le serveur
    // recevrait une écriture sur une ligne déjà supprimée.
    //
    // La clé est demandée à `entityKey`, jamais relue dans la colonne
    // attendue du tableau : comparer le tableau à lui-même ne prouverait que
    // sa cohérence interne, et laisserait passer la faute qui compte — un
    // `referee:` copié en `album:` d'un seul des deux côtés.
    const cleDe = new Map(
      CAS.map(([operation]) => [operation.kind, entityKey(operation)])
    );
    const suppressions = [...cleDe.keys()].filter(kind =>
      kind.endsWith('.delete')
    );

    expect(suppressions).toHaveLength(13);
    for (const suppression of suppressions) {
      const jumeau = suppression.replace('.delete', '.upsert');
      expect(cleDe.get(jumeau as RemoteOp['kind'])).toBe(
        cleDe.get(suppression)
      );
    }
  });

  it('deux entités différentes ne partagent jamais une clé', () => {
    // Toutes les opérations portent l'identifiant `x` : seul le PRÉFIXE les
    // distingue. Deux familles qui retomberaient sur la même clé feraient
    // fusionner des écritures sans rapport — la plus récente écraserait
    // l'autre, sans un mot.
    const cles = CAS.map(([operation]) => entityKey(operation)).filter(
      cle => cle !== null
    );

    // Dix-sept clés : seize familles d'entités, treize d'entre elles avec
    // upsert + delete, et la modification d'écriture à part de sa création.
    expect(new Set(cles).size).toBe(17);
  });

  it('lots et changements d’état ne fusionnent jamais', () => {
    // Fusionner un import de cent écritures avec le suivant en perdrait
    // cent ; fusionner une clôture avec une réouverture perdrait l'une des
    // deux, et la saison finirait dans l'état inverse du souhaité.
    const jamais = CAS.filter(([, cle]) => cle === null).map(
      ([operation]) => operation.kind
    );

    expect(jamais).toEqual([
      'entry.bulkUpsert',
      'season.close',
      'season.reopen',
    ]);
  });
});

describe('isTransient', () => {
  it.each([
    'Failed to fetch', // Chrome
    'Load failed', // Safari
    'NetworkError when attempting to fetch a resource.', // Firefox
    'connect ETIMEDOUT', // timeout
    'JWT expired', // jeton à rafraîchir
    '503 Service Unavailable',
  ])('réessayable : %s', msg => {
    expect(isTransient(msg)).toBe(true);
  });

  it.each(['permission denied (RLS)', 'duplicate key value', 'invalid input'])(
    'rejet serveur : %s',
    msg => {
      expect(isTransient(msg)).toBe(false);
    }
  );
});

describe('migrateLegacyItems', () => {
  beforeEach(() => {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(DEAD_KEY);
  });

  it('reprend les écritures en attente de l’ancien format (même clé localStorage)', () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        {
          id: 'q_1',
          op: { kind: 'event.delete', id: 'ev1' },
          attempts: 2,
          lastError: 'réseau',
        },
        { id: 'q_2', op: { kind: 'season.close', id: 's1' }, attempts: 0 },
      ])
    );

    migrateLegacyItems('queue');

    const items = JSON.parse(localStorage.getItem(QUEUE_KEY)!) as Array<
      Record<string, unknown>
    >;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'q_1',
      payload: { kind: 'event.delete', id: 'ev1' },
      key: 'event:ev1',
      attempts: 2,
      lastError: 'réseau',
    });
    expect(items[0]!.op).toBeUndefined(); // plus d’ancien champ
    expect(items[0]!.enqueuedAt).toEqual(expect.any(String));
    // Op non fusionnable : clé nulle, comme l’aurait produite le socle.
    expect(items[1]).toMatchObject({ id: 'q_2', key: null, attempts: 0 });
  });

  it('reprend aussi les lettres mortes', () => {
    localStorage.setItem(
      DEAD_KEY,
      JSON.stringify([
        {
          id: 'q_9',
          op: { kind: 'event.delete', id: 'ev9' },
          attempts: 3,
          lastError: 'permission denied',
        },
      ])
    );

    migrateLegacyItems('dead');

    const items = JSON.parse(localStorage.getItem(DEAD_KEY)!) as Array<
      Record<string, unknown>
    >;
    expect(items[0]).toMatchObject({
      id: 'q_9',
      payload: { kind: 'event.delete', id: 'ev9' },
      key: 'event:ev9',
      lastError: 'permission denied',
    });
  });

  it('idempotente : une entrée déjà au format socle est laissée intacte', () => {
    const socleItem = {
      id: 'q_3',
      payload: { kind: 'event.delete', id: 'ev3' },
      key: 'event:ev3',
      attempts: 1,
      enqueuedAt: '2026-08-01T00:00:00.000Z',
    };
    localStorage.setItem(QUEUE_KEY, JSON.stringify([socleItem]));

    migrateLegacyItems('queue');

    expect(JSON.parse(localStorage.getItem(QUEUE_KEY)!)).toEqual([socleItem]);
  });

  it('mélange ancien/nouveau : seul l’ancien est converti, l’ordre est préservé', () => {
    const socleItem = {
      id: 'q_new',
      payload: { kind: 'event.delete', id: 'ev2' },
      key: 'event:ev2',
      attempts: 0,
      enqueuedAt: '2026-08-01T00:00:00.000Z',
    };
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { id: 'q_old', op: { kind: 'event.delete', id: 'ev1' } },
        socleItem,
      ])
    );

    migrateLegacyItems('queue');

    const items = JSON.parse(localStorage.getItem(QUEUE_KEY)!) as Array<
      Record<string, unknown>
    >;
    expect(items.map(i => i.id)).toEqual(['q_old', 'q_new']);
    expect(items[0]).toMatchObject({ key: 'event:ev1', attempts: 0 });
    expect(items[1]).toEqual(socleItem);
  });

  it('contenu illisible ou absent : aucune exception, rien n’est écrit', () => {
    localStorage.setItem(QUEUE_KEY, 'pas du JSON');
    expect(() => migrateLegacyItems('queue')).not.toThrow();
    expect(localStorage.getItem(QUEUE_KEY)).toBe('pas du JSON');

    localStorage.removeItem(QUEUE_KEY);
    expect(() => migrateLegacyItems('queue')).not.toThrow();
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });
});

/**
 * Ce que l'app BRANCHE sur la file du socle : le transport, la classification
 * des échecs, l'observateur. La mécanique de file appartient au socle et y est
 * testée ; ce qui suit n'éprouve que les quatre fermetures passées à
 * `createSyncQueue`, qu'aucun test ne traversait.
 */
describe('getSyncQueue', () => {
  const SEASON_CLOSE: RemoteOp = { kind: 'season.close', id: 's1' };

  beforeEach(() => {
    setQueueTransport(null);
    setQueueObserver({});
    clearAll();
  });

  afterEach(() => {
    // `clear()` annule aussi le rejeu programmé : sans lui, le minuteur de
    // backoff d'un test transitoire survivrait au suivant.
    clearAll();
    setQueueTransport(null);
    setQueueObserver({});
  });

  it('sans transport branché, l’écriture part en lettre morte plutôt que de disparaître', async () => {
    const morts: RemoteOp[] = [];
    setQueueObserver({ onDead: operation => morts.push(operation) });
    const file = getSyncQueue();
    file.enqueue(SEASON_CLOSE);

    await file.flush();

    // « Transport non branché » est une erreur de CÂBLAGE, pas une panne
    // réseau : la classer transitoire ferait tourner la file indéfiniment,
    // en ligne comme hors ligne, sans que rien ne parte jamais.
    expect(morts).toEqual([SEASON_CLOSE]);
    expect(deadItems().map(entree => entree.payload)).toEqual([SEASON_CLOSE]);
    expect(file.pending()).toBe(0);
  });

  it('un rejet qui n’est pas une Error est classé quand même', async () => {
    // Un SDK tiers peut rejeter une chaîne, un objet, n'importe quoi. Sans le
    // repli `String(error)`, la classification recevrait `undefined` : toute
    // coupure réseau signalée de cette façon serait prise pour un rejet
    // définitif, et l'écriture jetée en lettre morte au lieu d'être rejouée.
    setQueueTransport(() => Promise.reject('Failed to fetch'));
    const file = getSyncQueue();
    file.enqueue(SEASON_CLOSE);

    await file.flush();

    expect(file.pending()).toBe(1);
    expect(file.list()[0]?.attempts).toBe(1);
    expect(deadItems()).toHaveLength(0);
  });

  it('une Error est classée sur son message, et un refus du serveur ne se rejoue pas', async () => {
    setQueueTransport(() =>
      Promise.reject(new Error('permission denied (RLS)'))
    );
    const file = getSyncQueue();
    file.enqueue(SEASON_CLOSE);

    await file.flush();

    expect(deadItems()).toHaveLength(1);
    expect(file.pending()).toBe(0);
  });

  it('onChange rend l’état de la file, et clearAll la vide des deux côtés', async () => {
    const etats: Array<{ pending: number; dead: number }> = [];
    setQueueObserver({ onChange: etat => etats.push(etat) });
    setQueueTransport(() => Promise.reject(new Error('permission denied')));
    const file = getSyncQueue();
    file.enqueue(SEASON_CLOSE);

    await file.flush();

    // C'est ce compte-là que l'indicateur des Réglages affiche.
    expect(etats.at(-1)).toEqual({ pending: 0, dead: 1 });

    clearAll();

    expect(deadItems()).toHaveLength(0);
    expect(file.pending()).toBe(0);
  });

  it('un transport qui aboutit vide la file', async () => {
    const envoyees: RemoteOp[] = [];
    setQueueTransport(operation => {
      envoyees.push(operation);
      return Promise.resolve();
    });
    const file = getSyncQueue();
    file.enqueue(SEASON_CLOSE);

    await file.flush();

    expect(envoyees).toEqual([SEASON_CLOSE]);
    expect(file.pending()).toBe(0);
    expect(deadItems()).toHaveLength(0);
  });
});

/**
 * LES GESTES PAR ÉCRITURE DE LA CONCURRENCE OPTIMISTE. La file du socle
 * fusionne par REMPLACEMENT et ne connaît que des gestes de groupe sur les
 * lettres mortes ; une modification d'écriture est un DIFF, jugé contre une
 * version. Ce qui suit éprouve les cinq endroits où les deux ne s'accordent
 * pas d'eux-mêmes — chacun, faute de ce code, perdrait ou écraserait une
 * modification sans un mot.
 */
describe('modifications d’écritures (OCC)', () => {
  const update = (
    id: string,
    expectedVersion: number,
    patch: EntryUpdateOp['patch']
  ): EntryUpdateOp => ({
    kind: 'entry.update',
    id,
    label: `Écriture ${id}`,
    expectedVersion,
    patch,
  });

  /** Envoie la file ; chaque envoi rend le résultat que le test lui dicte. */
  function transportRendant(...issues: Array<Error | null>): RemoteOp[] {
    const envoyees: RemoteOp[] = [];
    setQueueTransport(operation => {
      envoyees.push(operation);
      const issue = issues.shift() ?? null;
      return issue ? Promise.reject(issue) : Promise.resolve();
    });
    return envoyees;
  }

  const conflit = () =>
    new EntryWriteRejected('conflict', 'Conflit de version (rechargez).');

  beforeEach(() => {
    setQueueTransport(null);
    setQueueObserver({});
    clearAll();
  });

  afterEach(() => {
    clearAll();
    setQueueTransport(null);
    setQueueObserver({});
  });

  describe('withPendingPatch', () => {
    it('laisse passer telle quelle une opération qui n’est pas une modification', () => {
      const close: RemoteOp = { kind: 'season.close', id: 's1' };
      expect(withPendingPatch(close, getSyncQueue().list())).toBe(close);
    });

    it('rien n’attend sur cette écriture : l’opération part telle quelle', () => {
      getSyncQueue().enqueue(update('autre', 1, { label: 'x' }));
      const op = update('e1', 1, { amount: 12 });
      expect(withPendingPatch(op, getSyncQueue().list())).toBe(op);
    });

    it('fusionne avec la modification qui attend : aucun champ ne se perd', () => {
      // Sans la fusion, la file remplaçait la première modification par la
      // seconde : le libellé changé d'abord partait à la trappe.
      const file = getSyncQueue();
      file.enqueue(update('e1', 3, { label: 'Libellé', observation: 'o' }));
      const fusion = withPendingPatch(
        update('e1', 3, { amount: 12, observation: null }),
        file.list()
      );
      expect(fusion).toEqual(
        update('e1', 3, { label: 'Libellé', amount: 12, observation: null })
      );
      file.enqueue(fusion);
      expect(file.list().map(item => item.payload)).toEqual([fusion]);
    });

    it('garde la version la PLUS ANCIENNE : c’est contre elle que le patch doit être jugé', () => {
      const file = getSyncQueue();
      file.enqueue(update('e1', 2, { label: 'fait sur la v2' }));
      const fusion = withPendingPatch(
        update('e1', 5, { amount: 1 }),
        file.list()
      );
      expect(fusion).toMatchObject({ expectedVersion: 2 });
    });

    it('ignore une modification relancée sans clé (lettre morte revenue en file)', () => {
      const relancee: QueueItem = {
        id: 'r1',
        key: null,
        payload: update('e1', 1, { label: 'refusée' }),
        attempts: 0,
        enqueuedAt: '2026-09-25T00:00:00.000Z',
      };
      const op = update('e1', 1, { amount: 3 });
      expect(withPendingPatch(op, [relancee])).toBe(op);
    });
  });

  it('un refus de modification part en lettre morte d’emblée, quel que soit son texte', async () => {
    // Le texte ressemble à une panne réseau : sans le classement explicite
    // d'`EntryWriteRejected`, la file le rejouerait en boucle.
    transportRendant(new EntryWriteRejected('forbidden', 'network timeout'));
    getSyncQueue().enqueue(update('e1', 1, { label: 'x' }));

    await getSyncQueue().flush();

    expect(getSyncQueue().pending()).toBe(0);
    expect(deadItems()).toHaveLength(1);
    expect(deadItems()[0]?.attempts).toBe(1);
  });

  describe('une écriture, une lettre morte', () => {
    it('deux refus sur la même écriture fusionnent, et la lettre perd sa clé', async () => {
      transportRendant(conflit(), conflit());
      const file = getSyncQueue();
      file.enqueue(update('e1', 1, { label: 'A', observation: 'o' }));
      await file.flush();
      file.enqueue(update('e1', 1, { amount: 9, observation: null }));
      await file.flush();

      const morte = deadEntryUpdate('e1');
      expect(deadItems()).toHaveLength(1);
      expect(morte?.key).toBeNull();
      expect(morte?.payload).toEqual(
        update('e1', 1, { label: 'A', amount: 9, observation: null })
      );
      expect(morte?.lastError).toContain('[40001]');
    });

    it('garde la plus ancienne des versions attendues', () => {
      const mortes = [
        update('e1', 4, { label: 'A' }),
        update('e1', 2, { amount: 1 }),
      ].map((payload, i): QueueItem => ({
        id: `m${i}`,
        key: 'entry.update:e1',
        payload,
        attempts: 1,
        enqueuedAt: '2026-09-25T00:00:00.000Z',
        lastError: '[40001] Conflit',
      }));
      localStorage.setItem('miss-uwh:syncdead', JSON.stringify(mortes));

      consolidateDeadEntryUpdates('e1');

      expect(deadItems()).toHaveLength(1);
      expect(deadEntryUpdate('e1')?.payload).toMatchObject({
        expectedVersion: 2,
        patch: { label: 'A', amount: 1 },
      });
    });

    it('ne touche ni aux autres écritures ni aux autres opérations', async () => {
      transportRendant(
        conflit(),
        new Error('permission denied (RLS)'),
        conflit()
      );
      const file = getSyncQueue();
      file.enqueue(update('e1', 1, { label: 'A' }));
      file.enqueue({ kind: 'season.close', id: 's1' });
      file.enqueue(update('e2', 1, { label: 'B' }));
      await file.flush();

      expect(deadItems().map(item => item.payload.kind)).toEqual([
        'entry.update',
        'season.close',
        'entry.update',
      ]);
      // Une seule lettre par écriture : rien n'a été réécrit.
      consolidateDeadEntryUpdates('e1');
      consolidateDeadEntryUpdates('inconnue');
      expect(deadItems()).toHaveLength(3);
    });
  });

  describe('rebaseEntryUpdates', () => {
    it('reprend les modifications parties de la version quittée — en attente ET refusées', async () => {
      transportRendant(conflit());
      const file = getSyncQueue();
      file.enqueue(update('e1', 3, { label: 'refusée' }));
      await file.flush();
      file.enqueue(update('e1', 3, { amount: 1 }));
      file.enqueue(update('e2', 3, { amount: 2 }));

      rebaseEntryUpdates('e1', 3, 4);

      expect(
        pendingEntryUpdates('e1').map(i => i.payload.expectedVersion)
      ).toEqual([4]);
      expect(deadEntryUpdate('e1')?.payload.expectedVersion).toBe(4);
      // L'autre écriture n'a pas bougé.
      expect(pendingEntryUpdates('e2')[0]?.payload.expectedVersion).toBe(3);
    });

    it('ne reprend QUE la version quittée : une autre version n’est pas de notre fait', () => {
      const file = getSyncQueue();
      file.enqueue(update('e1', 2, { label: 'x' }));

      rebaseEntryUpdates('e1', 3, 4);

      expect(pendingEntryUpdates('e1')[0]?.payload.expectedVersion).toBe(2);
    });
  });

  it('takeEntryUpdates retire refusées ET en attente, dans l’ordre où elles ont été faites', async () => {
    const etats: Array<{ pending: number; dead: number }> = [];
    setQueueObserver({ onChange: etat => etats.push(etat) });
    transportRendant(conflit());
    const file = getSyncQueue();
    file.enqueue(update('e1', 1, { label: 'refusée' }));
    await file.flush();
    file.enqueue(update('e1', 1, { amount: 5 }));
    file.enqueue({ kind: 'season.close', id: 's1' });

    const retirees = takeEntryUpdates('e1');

    expect(retirees.map(op => op.patch)).toEqual([
      { label: 'refusée' },
      { amount: 5 },
    ]);
    expect(deadItems()).toHaveLength(0);
    expect(file.list().map(item => item.payload.kind)).toEqual([
      'season.close',
    ]);
    // L'indicateur des Réglages voit l'état réel.
    expect(etats.at(-1)).toEqual({ pending: 1, dead: 0 });
    // Rien pour une écriture sans modification.
    expect(takeEntryUpdates('inconnue')).toEqual([]);
  });

  describe('requeueRetryable (« Réessayer »)', () => {
    it('relance les refus ordinaires et laisse les conflits attendre une décision', async () => {
      transportRendant(
        conflit(),
        new EntryWriteRejected('forbidden', 'Droits insuffisants'),
        new Error('permission denied (RLS)')
      );
      const file = getSyncQueue();
      file.enqueue(update('e1', 1, { label: 'conflit' }));
      file.enqueue(update('e2', 1, { label: 'droits' }));
      file.enqueue({ kind: 'event.delete', id: 'ev1' });
      await file.flush();
      expect(deadItems()).toHaveLength(3);

      const relancees = requeueRetryable();

      expect(relancees).toBe(2);
      expect(file.list().map(item => item.payload.kind)).toEqual([
        'entry.update',
        'event.delete',
      ]);
      expect(deadItems().map(item => item.payload)).toEqual([
        update('e1', 1, { label: 'conflit' }),
      ]);
    });

    it('sans conflit, c’est la relance du socle, telle quelle', async () => {
      transportRendant(new Error('permission denied (RLS)'));
      const file = getSyncQueue();
      file.enqueue({ kind: 'event.delete', id: 'ev1' });
      await file.flush();

      expect(requeueRetryable()).toBe(1);
      expect(file.pending()).toBe(1);
      expect(deadItems()).toHaveLength(0);
    });
  });
});
