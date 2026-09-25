/**
 * La lecture des justificatifs : la requête envoyée à chaque fournisseur, et
 * la lecture DÉFENSIVE de ce qui revient. Un modèle ne répond pas toujours ce
 * qu'on lui demande — « 12,50 € » au lieu de 12.5, « 25/09/2026 » au lieu de
 * 2026-09-25, un bloc de code autour du JSON, un champ oublié, une catégorie
 * inventée. Ce qui suit tient ce que l'app en fait.
 *
 * Aucun appel réel : `fetch` est remplacé, et le canvas du module `image` du
 * socle passe par ses coutures (jsdom n'en a pas).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings, Category } from '../../shared/types/domain.ts';
import { CATEGORIES } from '../../shared/lib/categories.ts';
import {
  OCR_MAX_DIMENSION,
  blobToBase64,
  buildReceiptRequest,
  buildReceiptSystemPrompt,
  parseAmount,
  parseReceipt,
  parseReceiptDate,
  prepareReceiptFile,
  readReceipt,
  receiptParts,
} from './receiptOcr.ts';
import { ReceiptError } from './receipt.ts';

const anthropic: AiSettings = { provider: 'anthropic', apiKey: 'sk-ant' };
const openai: AiSettings = {
  provider: 'openai',
  apiKey: 'sk-oa',
  model: 'gpt-4o',
};

const image = { kind: 'image', mediaType: 'image/jpeg', data: 'SU1H' } as const;
const pdf = { kind: 'pdf', data: 'JVBER' } as const;

const custom: Category = {
  code: 'C1',
  label: 'Sponsoring',
  sens: 'recette',
  kind: 'exploitation',
};
const CATS: readonly Category[] = [...CATEGORIES, custom];

const body = (init: { body: string }) => JSON.parse(init.body);

describe('buildReceiptRequest', () => {
  it('Anthropic : le justificatif en bloc image base64, la consigne ensuite', () => {
    const { url, init } = buildReceiptRequest(anthropic, image, CATS);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const sent = body(init);
    expect(sent.messages[0].content).toEqual([
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: 'SU1H' },
      },
      {
        type: 'text',
        text: 'Lis ce justificatif et réponds avec le JSON demandé.',
      },
    ]);
    expect(sent.max_tokens).toBe(1024);
  });

  it('Anthropic : un PDF part en document', () => {
    const { init } = buildReceiptRequest(anthropic, pdf, CATS);
    expect(body(init).messages[0].content[0]).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'JVBER' },
    });
  });

  it('OpenAI-compatible : `image_url` en data URL, sortie JSON exigée', () => {
    const { url, init } = buildReceiptRequest(openai, image, CATS);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const sent = body(init);
    expect(sent.response_format).toEqual({ type: 'json_object' });
    expect(sent.messages[1].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,SU1H' },
    });
  });

  it('OpenAI-compatible : un PDF est refusé avant tout envoi', () => {
    expect(() => buildReceiptRequest(openai, pdf, CATS)).toThrow(
      expect.objectContaining({ code: 'pdf-unsupported' })
    );
  });

  it('le prompt système donne le schéma et la liste FERMÉE des catégories, personnalisées comprises', () => {
    const system = buildReceiptSystemPrompt(CATS);
    expect(system).toContain('"categoryCode"');
    expect(system).toContain('"confidence"');
    expect(system).toContain('D8 — Frais de bouche (dépense)');
    expect(system).toContain('R1 — Inscriptions / Cotisations (recette)');
    expect(system).toContain('C1 — Sponsoring (recette)');
    // Le même prompt, quel que soit le fournisseur.
    expect(
      body(buildReceiptRequest(openai, image, CATS).init).messages[0]
    ).toEqual({ role: 'system', content: system });
  });

  it('receiptParts : l’image avant le texte', () => {
    expect(receiptParts(image).map(p => p.type)).toEqual(['image', 'text']);
    expect(receiptParts(pdf).map(p => p.type)).toEqual(['pdf', 'text']);
  });
});

describe('parseAmount', () => {
  it.each([
    [12.5, 12.5],
    [-45, 45],
    [12.345, 12.35],
    ['12,50 €', 12.5],
    ['12.50', 12.5],
    ['EUR 45', 45],
    ['1 234,56 €', 1234.56],
    // Espace fine insécable (U+202F) : le séparateur de milliers d'`Intl` en français.
    ['1\u202f234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234', 1234],
    ['1,5', 1.5],
    ['-12,00', 12],
    ['TOTAL TTC : 32,90€', 32.9],
  ])('%j → %j', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([[0], ['0,00'], ['gratuit'], [''], [null], [Number.NaN], [{}]])(
    'illisible ou nul : %j → rien',
    input => {
      expect(parseAmount(input)).toBeUndefined();
    }
  );
});

describe('parseReceiptDate', () => {
  it.each([
    ['2026-09-25', '2026-09-25'],
    ['2026-9-5', '2026-09-05'],
    ['2026-09-25T14:03:00Z', '2026-09-25'],
    ['25/09/2026', '2026-09-25'],
    ['5/9/2026', '2026-09-05'],
    ['25.09.26', '2026-09-25'],
    ['25-09-2026', '2026-09-25'],
    [' 29/02/2028 ', '2028-02-29'],
  ])('%j → %j', (input, expected) => {
    expect(parseReceiptDate(input)).toBe(expected);
  });

  it.each([
    ['31/02/2026'],
    ['29/02/2026'],
    ['2026-13-01'],
    ['25 septembre 2026'],
    ['09/2026'],
    [''],
    [20260925],
    [null],
  ])('pas une date du calendrier : %j → rien', input => {
    expect(parseReceiptDate(input)).toBeUndefined();
  });
});

describe('parseReceipt', () => {
  it('lit la forme demandée', () => {
    expect(
      parseReceipt(
        '{"date":"2026-09-20","amount":32.9,"label":"Decathlon — palmes","sens":"debit","categoryCode":"D4","confidence":0.92}',
        CATS
      )
    ).toEqual({
      date: '2026-09-20',
      amount: 32.9,
      label: 'Decathlon — palmes',
      sens: 'debit',
      categoryCode: 'D4',
      confidence: 0.92,
    });
  });

  it('tolère un bloc de code, un montant et une date à la française', () => {
    const text =
      'Voici la lecture :\n```json\n{"date":"20/09/2026","amount":"32,90 €","label":"  Buvette   Leclerc ","sens":"Dépense","categoryCode":"d8","confidence":"85%"}\n```';
    expect(parseReceipt(text, CATS)).toEqual({
      date: '2026-09-20',
      amount: 32.9,
      label: 'Buvette Leclerc',
      sens: 'debit',
      categoryCode: 'D8',
      confidence: 0.85,
    });
  });

  it('accepte les clés françaises et un tableau d’un élément', () => {
    expect(
      parseReceipt(
        '[{"date":"2026-09-20","montant":"15","libelle":"Don","catégorie":"C1 — Sponsoring"}]',
        CATS
      )
    ).toEqual({
      date: '2026-09-20',
      amount: 15,
      label: 'Don',
      // Pas de sens lu : celui de la catégorie.
      sens: 'credit',
      categoryCode: 'C1',
    });
  });

  it('les champs manquants restent absents — le formulaire garde les siens', () => {
    expect(parseReceipt('{"amount":8,"date":null,"label":""}', CATS)).toEqual({
      amount: 8,
    });
  });

  it('écarte une catégorie inventée', () => {
    expect(
      parseReceipt(
        '{"amount":8,"sens":"debit","categoryCode":"Z99","confidence":0.4}',
        CATS
      )
    ).toEqual({ amount: 8, sens: 'debit', confidence: 0.4 });
  });

  it('écarte une catégorie qui contredit le sens lu, et garde le sens', () => {
    // Une dépense rangée sous R1 (recette) : l'utilisateur choisira.
    expect(
      parseReceipt('{"amount":8,"sens":"debit","categoryCode":"R1"}', CATS)
    ).toEqual({ amount: 8, sens: 'debit' });
  });

  it('borne la confiance, et ignore une confiance illisible', () => {
    expect(parseReceipt('{"amount":1,"confidence":1.7}', CATS).confidence).toBe(
      0.017
    );
    expect(parseReceipt('{"amount":1,"confidence":250}', CATS).confidence).toBe(
      1
    );
    expect(
      parseReceipt('{"amount":1,"confidence":"élevée"}', CATS).confidence
    ).toBeUndefined();
    expect(
      parseReceipt('{"amount":1,"confidence":-1}', CATS).confidence
    ).toBeUndefined();
  });

  it('un libellé trop long est coupé', () => {
    const label = 'x'.repeat(300);
    expect(parseReceipt(JSON.stringify({ label }), CATS).label?.length).toBe(
      120
    );
  });

  it('rien de lisible est une erreur, pas un formulaire vide', () => {
    expect(() =>
      parseReceipt('{"sens":"debit","confidence":0.1}', CATS)
    ).toThrow(ReceiptError);
    expect(() => parseReceipt('{}', CATS)).toThrow(
      expect.objectContaining({ code: 'empty' })
    );
  });

  it('une réponse sans objet est illisible', () => {
    expect(() => parseReceipt('[]', CATS)).toThrow(
      expect.objectContaining({ code: 'unreadable' })
    );
    expect(() => parseReceipt('Je ne peux pas lire ce ticket.', CATS)).toThrow(
      expect.objectContaining({ code: 'unreadable' })
    );
  });
});

// ── Préparation du fichier (coutures du socle) et lecture complète ───

/** Des coutures qui simulent un décodage de 4000 × 3000 px. */
function seams() {
  const rendered: Array<{ width: number; height: number }> = [];
  return {
    rendered,
    seams: {
      decode: async () => ({ width: 4000, height: 3000, close: () => {} }),
      render: (_bitmap: unknown, width: number, height: number) => {
        rendered.push({ width, height });
        return { width, height };
      },
      encode: async () =>
        new Blob([new Uint8Array([0xff, 0xd8, 0xff])], {
          type: 'image/jpeg',
        }),
    },
  };
}

const photo = () =>
  new File([new Uint8Array(1000)], 'ticket.HEIC', { type: 'image/heic' });

describe('prepareReceiptFile', () => {
  it('une photo est réduite au côté long visé et ré-encodée en JPEG', async () => {
    const { rendered, seams: s } = seams();
    const prepared = await prepareReceiptFile(photo(), s);
    expect(rendered[0]).toEqual({ width: OCR_MAX_DIMENSION, height: 1176 });
    expect(prepared).toEqual({
      kind: 'image',
      mediaType: 'image/jpeg',
      data: '/9j/',
    });
  });

  it('un PDF part tel quel, en base64', async () => {
    const file = new File(['%PDF-1.4'], 'facture.pdf', {
      type: 'application/pdf',
    });
    expect(await prepareReceiptFile(file)).toEqual({
      kind: 'pdf',
      data: await blobToBase64(file),
    });
  });

  it('refuse ce qui n’est ni une image ni un PDF', async () => {
    await expect(
      prepareReceiptFile(new File(['a;b'], 'releve.csv', { type: 'text/csv' }))
    ).rejects.toThrow(expect.objectContaining({ code: 'unsupported-type' }));
  });

  it('refuse un PDF trop lourd', async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'gros.pdf', {
      type: 'application/pdf',
    });
    await expect(prepareReceiptFile(big)).rejects.toThrow(
      expect.objectContaining({ code: 'too-large' })
    );
  });

  it('une image que le navigateur ne sait pas décoder est dite illisible', async () => {
    await expect(
      prepareReceiptFile(photo(), {
        decode: async () => {
          throw new Error('decode');
        },
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'image-unreadable' }));
  });
});

describe('readReceipt', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('photo → fournisseur → brouillon, sans rien enregistrer', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"date":"2026-09-20","amount":"12,50","label":"Piscine","sens":"debit","categoryCode":"D9","confidence":0.9}',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const draft = await readReceipt(photo(), anthropic, CATS, {
      seams: seams().seams,
    });

    expect(draft).toEqual({
      date: '2026-09-20',
      amount: 12.5,
      label: 'Piscine',
      sens: 'debit',
      categoryCode: 'D9',
      confidence: 0.9,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(
      JSON.parse(init.body as string).messages[0].content[0].source
    ).toEqual({ type: 'base64', media_type: 'image/jpeg', data: '/9j/' });
  });

  it('un PDF chez un fournisseur compatible OpenAI est refusé AVANT toute préparation et tout envoi', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['%PDF'], 'facture.pdf', {
      type: 'application/pdf',
    });

    await expect(readReceipt(file, openai, CATS)).rejects.toThrow(
      expect.objectContaining({ code: 'pdf-unsupported' })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
