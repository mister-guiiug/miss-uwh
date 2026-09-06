/**
 * Ce que ces tests tiennent : le fichier qui part au bureau CONTIENT le bilan.
 *
 * Le piège d'un export PDF, c'est qu'il « marche » — un fichier est produit,
 * il s'ouvre, on est rassuré. On ne voit pas qu'un montant manque, qu'une
 * catégorie a sauté, ou qu'un « ? » a remplacé un caractère. Les octets sont
 * donc RELUS : les flux du générateur du socle ne sont pas compressés
 * (`/Length n` puis les octets bruts) et le texte y est en WinAnsi, donc un
 * décodage latin1 suffit à retrouver ce qui est écrit dans la page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bilan, BilanLine, EventResult } from '../../shared/lib/engine.ts';
import type { Season } from '../../shared/types/domain.ts';
import {
  bilanPdfFilename,
  buildBilanPdfRows,
  renderBilanPdf,
  shareOrDownloadBilanPdf,
  toPdfText,
} from './bilanPdf.ts';

const season: Season = {
  id: 's1',
  label: '2025-2026',
  startDate: '2025-05-15',
  endDate: '2026-05-15',
  status: 'ouverte',
  openingBalance: 2364.85,
};

function line(p: Partial<BilanLine> & { code: string }): BilanLine {
  return {
    label: 'Libellé',
    sens: 'recette',
    kind: 'exploitation',
    total: 0,
    count: 1,
    status: 'complete',
    ...p,
  };
}

const bilan: Bilan = {
  season,
  recettes: [
    line({ code: 'R1', label: 'Cotisations', total: 3160 }),
    line({ code: 'R3', label: 'Subventions', total: 1200 }),
    // Sans écriture ni montant : ne doit PAS figurer au bilan de l'AG.
    line({
      code: 'R9',
      label: 'Divers',
      total: 0,
      count: 0,
      status: 'a_completer',
    }),
    line({
      code: 'R-COMP',
      label: 'Recettes compensées',
      total: 90,
      kind: 'compensee',
    }),
  ],
  depenses: [
    line({
      code: 'D1',
      label: 'Licences FFESSM',
      sens: 'depense',
      total: 1420.5,
    }),
    line({ code: 'D4', label: 'Matériel', sens: 'depense', total: 780.25 }),
  ],
  reliquat: 2364.85,
  totalRecettesHorsReliquat: 4450,
  totalRecettes: 6814.85,
  totalDepenses: 2200.75,
  soldeCrediteur: 4614.1,
  resultatExploitation: 2159.25,
  tresorerie: 4614.1,
  compensated: { recettes: 90, depenses: 0 },
};

const events: EventResult[] = [
  {
    event: {
      id: 'e1',
      seasonId: 's1',
      name: 'Tournoi des Arvernes',
      kind: 'tournoi',
    },
    recettes: 1800,
    depenses: 640.4,
    net: 1159.6,
    count: 12,
  },
];

const input = {
  clubName: 'Clermont Hockey Sub',
  treasurer: 'Jean Trésorier',
  bilan,
  events,
  generatedAt: new Date('2026-06-15T10:00:00'),
};

/** latin1 : un octet = un caractère, donc le texte du flux se relit tel quel. */
const dec = new TextDecoder('latin1');
const readPdf = (bytes: Uint8Array) => dec.decode(bytes);

describe('buildBilanPdfRows', () => {
  it('porte les totaux du bilan et la trésorerie', () => {
    const rows = buildBilanPdfRows(input);
    const find = (label: string) => rows.find(r => r.label === label);

    expect(find("Reliquat d'ouverture")?.value).toBe('2364,85 EUR');
    expect(find('Trésorerie de clôture')?.value).toBe('4614,10 EUR');
    expect(find('Total recettes (hors reliquat)')?.value).toBe('4450,00 EUR');
    expect(find('Total recettes (reliquat inclus)')?.value).toBe('6814,85 EUR');
    expect(find('Total dépenses')?.value).toBe('2200,75 EUR');
    expect(find('Solde créditeur')?.value).toBe('+4614,10 EUR');
    expect(find("Résultat d'exploitation")?.value).toBe('+2159,25 EUR');
  });

  it('omet une catégorie sans écriture ni montant', () => {
    const labels = buildBilanPdfRows(input).map(r => r.label);
    expect(labels).toContain('R1 Cotisations');
    expect(labels).not.toContain('R9 Divers');
  });

  it('respecte le réglage « masquer les compensées »', () => {
    const shown = buildBilanPdfRows(input).map(r => r.label);
    const hidden = buildBilanPdfRows({ ...input, hideCompensated: true }).map(
      r => r.label
    );
    expect(shown).toContain('R-COMP Recettes compensées');
    expect(hidden).not.toContain('R-COMP Recettes compensées');
  });

  it('rend le résultat par événement, signé', () => {
    const row = buildBilanPdfRows(input).find(r =>
      r.label.startsWith('Tournoi des Arvernes')
    );
    expect(row?.label).toBe(
      'Tournoi des Arvernes (+1800,00 EUR / -640,40 EUR)'
    );
    expect(row?.value).toBe('+1159,60 EUR');
  });

  it('rend un résultat négatif avec son signe', () => {
    const rows = buildBilanPdfRows({
      ...input,
      bilan: { ...bilan, resultatExploitation: -318.4 },
    });
    expect(rows.find(r => r.label === "Résultat d'exploitation")?.value).toBe(
      '-318,40 EUR'
    );
  });
});

describe('toPdfText', () => {
  it('conserve les accents (Latin-1) et transcrit le reste', () => {
    expect(toPdfText('Dépenses à régler — çà et là')).toBe(
      'Dépenses à régler - çà et là'
    );
    expect(toPdfText('−44,00 €')).toBe('-44,00 EUR');
    expect(toPdfText('l’Œuvre')).toBe("l'OEuvre");
  });

  it("omet ce qui n'a pas d'équivalent plutôt que d'écrire « ? »", () => {
    expect(toPdfText('Buvette 🍺 2026')).toBe('Buvette  2026');
  });

  it('ramène les espaces exotiques à une espace simple', () => {
    // `Intl` sépare les milliers, en français, par une espace fine insécable
    // (U+202F) ou insécable (U+00A0) selon la version d'ICU. Ces caractères
    // sont INVISIBLES dans un fichier source : le test les nomme par leur
    // point de code plutôt que de les coller, sinon personne ne saurait dire
    // lequel il éprouve — ni pourquoi il échoue.
    for (const cp of [0x202f, 0x2009, 0x00a0]) {
      expect(toPdfText(`1${String.fromCodePoint(cp)}234,50 EUR`)).toBe(
        '1 234,50 EUR'
      );
    }
  });
});

describe('renderBilanPdf', () => {
  it('produit un PDF valide', () => {
    const text = readPdf(renderBilanPdf(input));
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('le fichier contient le club, la saison et la date d’édition', () => {
    const text = readPdf(renderBilanPdf(input));
    expect(text).toContain('Clermont Hockey Sub');
    expect(text).toContain('Bilan de la saison 2025-2026');
    expect(text).toContain('15/06/2026');
    expect(text).toContain('Jean Trésorier');
  });

  it('le fichier contient les montants et les libellés de catégories', () => {
    const text = readPdf(renderBilanPdf(input));
    for (const expected of [
      'R1 Cotisations',
      'R3 Subventions',
      'D1 Licences FFESSM',
      'D4 Matériel',
      '3160,00 EUR',
      '1200,00 EUR',
      '1420,50 EUR',
      '780,25 EUR',
      '2364,85 EUR',
      '6814,85 EUR',
      '2200,75 EUR',
      '+4614,10 EUR',
      '+2159,25 EUR',
      'Tournoi des Arvernes',
      '+1159,60 EUR',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("n'écrit aucun « ? » de substitution", () => {
    // Le générateur remplace par « ? » ce qu'il ne sait pas encoder. Aucun
    // libellé de ce bilan n'en contient : tout « ? » serait un caractère perdu.
    const text = readPdf(
      renderBilanPdf({ ...input, clubName: 'Club « Océan » 🐙' })
    );
    const streams = [...text.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(
      m => m[1] ?? ''
    );
    expect(streams.length).toBeGreaterThan(0);
    expect(streams.join('')).not.toContain('?');
  });

  it('pagine quand le bilan déborde de la page', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      line({ code: `R${i}`, label: `Catégorie ${i}`, total: i + 1 })
    );
    const bytes = renderBilanPdf({
      ...input,
      bilan: { ...bilan, recettes: many },
    });
    const text = readPdf(bytes);
    expect(text.match(/\/Type \/Page \/Parent/g)?.length ?? 0).toBeGreaterThan(
      1
    );
    // La dernière catégorie n'a pas été perdue au passage de page.
    expect(text).toContain('R79 Catégorie 79');
  });
});

describe('shareOrDownloadBilanPdf', () => {
  const nav = () =>
    globalThis.navigator as Navigator & {
      canShare?: (data?: unknown) => boolean;
      share?: (data?: unknown) => Promise<void>;
    };

  function stubNavigator(props: Record<string, unknown>) {
    for (const [key, value] of Object.entries(props)) {
      Object.defineProperty(globalThis.navigator, key, {
        value,
        configurable: true,
        writable: true,
      });
    }
  }

  afterEach(() => {
    for (const key of ['share', 'canShare']) {
      if (key in globalThis.navigator) {
        Reflect.deleteProperty(globalThis.navigator, key);
      }
    }
    vi.restoreAllMocks();
  });

  it('partage le FICHIER quand la plateforme le permet', async () => {
    const share = vi.fn(async (_data?: unknown) => {});
    stubNavigator({ share, canShare: () => true });

    await expect(shareOrDownloadBilanPdf(input)).resolves.toBe('shared');

    const payload = share.mock.calls[0]?.[0] as
      | { files?: File[]; title?: string }
      | undefined;
    expect(payload?.files).toHaveLength(1);
    expect(payload?.files?.[0]?.name).toBe('bilan-2025-2026-2026-06-15.pdf');
    expect(payload?.files?.[0]?.type).toBe('application/pdf');
    expect(payload?.title).toContain('Clermont Hockey Sub');
  });

  it('télécharge quand le navigateur ne partage pas de fichier', async () => {
    // `canShare` refuse : c'est le cas de tous les navigateurs de bureau.
    stubNavigator({ share: vi.fn(async () => {}), canShare: () => false });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await expect(shareOrDownloadBilanPdf(input)).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    expect(nav().share).not.toHaveBeenCalled();
  });

  it("ne télécharge RIEN quand l'utilisateur ferme la feuille de partage", async () => {
    // L'annulation n'est pas un échec : déclencher un téléchargement dont
    // personne n'a voulu serait la pire des réponses.
    const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
    stubNavigator({
      share: vi.fn(async () => {
        throw abort;
      }),
      canShare: () => true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await expect(shareOrDownloadBilanPdf(input)).resolves.toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });
});

describe('bilanPdfFilename', () => {
  it('nomme le fichier par la saison et le jour d’édition', () => {
    expect(bilanPdfFilename(input)).toBe('bilan-2025-2026-2026-06-15.pdf');
  });

  it('assainit un libellé de saison exotique', () => {
    expect(
      bilanPdfFilename({
        ...input,
        bilan: { ...bilan, season: { ...season, label: 'Saison 25/26' } },
      })
    ).toBe('bilan-Saison-25-26-2026-06-15.pdf');
  });
});
