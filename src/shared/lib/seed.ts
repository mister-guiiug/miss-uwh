/**
 * Données initiales et jeu d'exemples réaliste, extrait du classeur réel
 * « Bilan comptable 2025-2026 » du club Clermont Hockey Sub.
 *
 * Le seed embarque un échantillon représentatif (toutes natures d'écritures :
 * exploitation, événement, compensée, composantes tarifaires) — l'intégralité
 * du journal s'obtient via l'import Excel (cf. features/import).
 */
import type {
  AppData,
  EventLedger,
  JournalEntry,
  Season,
  Settings,
} from '../types/domain.ts';
import { createId } from './id.ts';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  decimals: 2,
  showCompensated: true,
};

let order = 0;
type Seed = Omit<
  JournalEntry,
  'id' | 'seasonId' | 'attachments' | 'createdAt' | 'updatedAt' | 'version'
> &
  Partial<
    Pick<
      JournalEntry,
      'components' | 'eventId' | 'pieceRef' | 'invoiceCode' | 'observation'
    >
  >;

function mk(seasonId: string, s: Seed): JournalEntry {
  order += 1;
  return {
    id: createId('ec'),
    seasonId,
    attachments: [],
    createdAt: order,
    updatedAt: order,
    version: 1,
    ...s,
  };
}

export function createInitialData(): AppData {
  const season: Season = {
    id: createId('sea'),
    label: '2025-2026',
    startDate: '2025-05-15',
    endDate: '2026-05-15',
    status: 'ouverte',
    openingBalance: 2364.85, // reliquat exercice 2024-2025
  };

  // Saisons antérieures (clôturées) — historique multi-saisons réel (onglet
  // « Evolution » du classeur), pour la synthèse d'évolution.
  const history: Season[] = (
    [
      ['2020-2021', 2910.09, 22876.79, 18173.76, 4703.03],
      ['2021-2022', 4703.03, 23723.1, 22458.83, 1264.27],
      ['2022-2023', 1264.27, 31084.37, 27703.84, 3380.53],
      ['2023-2024', 3380.53, 44836.32, 40372.09, 4464.23],
      ['2024-2025', 4464.23, 49536.46, 44152.64, 5383.82],
    ] as const
  ).map(([label, opening, totalRecettes, totalDepenses, closing]) => {
    const year = Number(label.slice(0, 4));
    return {
      id: createId('sea'),
      label,
      startDate: `${year}-05-15`,
      endDate: `${year + 1}-05-15`,
      status: 'cloturee' as const,
      openingBalance: opening,
      closingBalance: closing,
      summary: { totalRecettes, totalDepenses },
      lockedAt: order,
    };
  });

  const tda: EventLedger = {
    id: createId('ev'),
    seasonId: season.id,
    name: 'Tournoi des Arvernes 2026',
    kind: 'tournoi',
  };
  const buvette: EventLedger = {
    id: createId('ev'),
    seasonId: season.id,
    name: 'Buvette TDA + CDF',
    kind: 'buvette',
  };

  const sid = season.id;
  const entries: JournalEntry[] = [
    // Inscriptions / cotisations (avec composantes)
    mk(sid, {
      categoryCode: 'R1',
      date: '2025-09-10',
      label: 'HelloAsso inscriptions',
      sens: 'credit',
      amount: 647,
      method: 'helloasso',
      invoiceCode: 'HelloAsso',
    }),
    mk(sid, {
      categoryCode: 'R1',
      date: '2025-10-22',
      label: 'Inscription famille (2 adultes + 1 enfant)',
      sens: 'credit',
      amount: 294,
      method: 'virement',
      components: { adulte_plein: 160, enfant: 94, licence: 40 },
    }),
    mk(sid, {
      categoryCode: 'R1',
      date: '2025-11-07',
      label: 'HelloAsso inscriptions',
      sens: 'credit',
      amount: 2378,
      method: 'helloasso',
    }),
    // Subventions
    mk(sid, {
      categoryCode: 'R2',
      date: '2025-09-29',
      label: 'FFESSM subvention',
      sens: 'credit',
      amount: 1219.36,
      method: 'virement',
      invoiceCode: 'FA250517',
    }),
    // Remboursements FFESSM
    mk(sid, {
      categoryCode: 'R3',
      date: '2025-09-25',
      label: 'Remboursement FFESSM CF D1 8-9/03/2025',
      sens: 'credit',
      amount: 1000,
      method: 'virement',
      invoiceCode: 'FACT2504282',
    }),
    mk(sid, {
      categoryCode: 'R3',
      date: '2026-04-21',
      label: 'VIR FFESSM',
      sens: 'credit',
      amount: 1500,
      method: 'virement',
    }),
    // Vente de matériels
    mk(sid, {
      categoryCode: 'R7',
      date: '2025-10-22',
      label: 'Vente matériel à un adhérent',
      sens: 'credit',
      amount: 79.5,
      method: 'virement',
    }),
    // Soutien asso (remboursement frais bancaires)
    mk(sid, {
      categoryCode: 'R8',
      date: '2025-10-03',
      label: 'Soutien asso',
      sens: 'credit',
      amount: 14.67,
      method: 'prelevement',
    }),
    // Intérêts livret
    mk(sid, {
      categoryCode: 'R-INT',
      date: '2025-12-31',
      label: 'Intérêts épargne livret',
      sens: 'credit',
      amount: 65.12,
      method: 'virement',
    }),
    // TDA — recettes (événement)
    mk(sid, {
      categoryCode: 'R5',
      date: '2026-02-04',
      label: 'Ligue des Opens Hockey Sub',
      sens: 'credit',
      amount: 4080,
      method: 'virement',
      eventId: tda.id,
    }),
    mk(sid, {
      categoryCode: 'R5',
      date: '2026-02-04',
      label: 'Ligue des Opens Hockey Sub',
      sens: 'credit',
      amount: 270,
      method: 'virement',
      eventId: tda.id,
    }),
    // Buvette (événement)
    mk(sid, {
      categoryCode: 'R6',
      date: '2026-02-10',
      label: 'Buvette — virement Stripe',
      sens: 'credit',
      amount: 807,
      method: 'stripe',
      eventId: buvette.id,
    }),
    mk(sid, {
      categoryCode: 'R6',
      date: '2026-01-20',
      label: 'Buvette — TPE',
      sens: 'credit',
      amount: 369.5,
      method: 'monetico',
      eventId: buvette.id,
    }),
    // Participations déplacements
    mk(sid, {
      categoryCode: 'R9',
      date: '2025-07-21',
      label: 'Remboursement déplacement D3 Montluçon',
      sens: 'credit',
      amount: 68.84,
      method: 'virement',
    }),

    // Licences FFESSM (avec composantes)
    mk(sid, {
      categoryCode: 'D1',
      date: '2025-11-17',
      label: 'Licences FFESSM',
      sens: 'debit',
      amount: 1018.5,
      method: 'virement',
      invoiceCode: 'FA230298',
      components: { adulte: 700, jeune: 250, enfant: 68.5 },
    }),
    // Affiliations
    mk(sid, {
      categoryCode: 'D3',
      date: '2025-10-06',
      label: 'Affiliation FFESSM',
      sens: 'debit',
      amount: 80,
      method: 'virement',
      invoiceCode: 'FA229833',
    }),
    // Achat matériels de hockey
    mk(sid, {
      categoryCode: 'D4',
      date: '2025-12-04',
      label: 'Commande gants',
      sens: 'debit',
      amount: 832.05,
      method: 'virement',
    }),
    mk(sid, {
      categoryCode: 'D4',
      date: '2025-10-27',
      label: 'Commande DiveInn matériel',
      sens: 'debit',
      amount: 579.81,
      method: 'virement',
    }),
    // Déplacements
    mk(sid, {
      categoryCode: 'D5',
      date: '2025-06-22',
      label: 'Hôtel déplacement Montluçon',
      sens: 'debit',
      amount: 473.89,
      method: 'virement',
    }),
    // TDA — dépenses (événement)
    mk(sid, {
      categoryCode: 'D7',
      date: '2026-01-20',
      label: 'Bourriches TDA 2026',
      sens: 'debit',
      amount: 1200,
      method: 'virement',
      eventId: tda.id,
    }),
    mk(sid, {
      categoryCode: 'D7',
      date: '2026-01-15',
      label: 'Saint-Nectaire TDA 2026',
      sens: 'debit',
      amount: 520,
      method: 'virement',
      eventId: tda.id,
    }),
    // Frais de bouche
    mk(sid, {
      categoryCode: 'D8',
      date: '2026-02-23',
      label: 'Réunion pizza',
      sens: 'debit',
      amount: 48.46,
      method: 'virement',
    }),
    // Location piscine + cartes
    mk(sid, {
      categoryCode: 'D9',
      date: '2025-07-16',
      label: 'Location piscine Coubertin',
      sens: 'debit',
      amount: 1000,
      method: 'virement',
    }),
    // Frais bancaires
    mk(sid, {
      categoryCode: 'D12',
      date: '2025-09-10',
      label: 'Frais SG',
      sens: 'debit',
      amount: 14.67,
      method: 'prelevement',
      invoiceCode: 'SGT2884',
    }),

    // Écriture compensée : gratuité de location de piscine (recette = dépense)
    mk(sid, {
      categoryCode: 'R-COMP',
      date: '2026-05-15',
      label: 'Gratuité location piscine (valorisation)',
      sens: 'credit',
      amount: 28341.5,
      method: 'autre',
      observation: 'Écriture non monétaire compensée par D-COMP',
    }),
    mk(sid, {
      categoryCode: 'D-COMP',
      date: '2026-05-15',
      label: 'Location piscine Clermont Communauté (gratuité)',
      sens: 'debit',
      amount: 28341.5,
      method: 'autre',
      observation: 'Écriture non monétaire compensée par R-COMP',
    }),
  ];

  return {
    version: SCHEMA_VERSION,
    club: {
      name: 'Clermont Hockey Sub',
      ffessmAffiliation: 'FFESSM + AURA + OMS',
      treasurer: 'Trésorier du club',
    },
    seasons: [...history, season],
    activeSeasonId: season.id,
    entries,
    events: [tda, buvette],
    recurrings: [
      {
        id: createId('rec'),
        label: 'Soutien asso (prélèvement mensuel)',
        categoryCode: 'R8',
        amount: 14.67,
        method: 'prelevement',
      },
      {
        id: createId('rec'),
        label: 'Frais bancaires SG',
        categoryCode: 'D12',
        amount: 14.67,
        method: 'prelevement',
      },
    ],
    customCategories: [],
    adherents: [
      {
        id: createId('adh'),
        seasonId: sid,
        firstName: 'Adulte',
        lastName: 'Démo',
        category: 'adulte',
        roles: ['joueur', 'encadrant'],
        status: 'actif',
        amount: 160,
        paid: true,
      },
      {
        id: createId('adh'),
        seasonId: sid,
        firstName: 'Enfant',
        lastName: 'Démo',
        category: 'enfant',
        roles: ['joueur'],
        status: 'actif',
        amount: 94,
        paid: false,
      },
    ],
    guardians: [],
    clubEvents: [],
    announcements: [],
    tournaments: [],
    trainingSessions: [],
    exercises: [],
    audit: [
      {
        id: createId('aud'),
        ts: order,
        actor: 'local',
        action: 'seed.init',
        category: 'metier',
        targetType: 'app',
        summary: 'Initialisation avec le jeu d’exemples 2025-2026.',
      },
    ],
    settings: DEFAULT_SETTINGS,
    onboarded: false,
  };
}

/** Données vierges (après réinitialisation) : une seule saison ouverte. */
export function createEmptyData(
  clubName = 'Mon club',
  seasonLabel = '2025-2026',
  openingBalance = 0
): AppData {
  const season: Season = {
    id: createId('sea'),
    label: seasonLabel,
    startDate: `${seasonLabel.slice(0, 4)}-09-01`,
    endDate: `${Number(seasonLabel.slice(0, 4)) + 1}-08-31`,
    status: 'ouverte',
    openingBalance,
  };
  return {
    version: SCHEMA_VERSION,
    club: { name: clubName },
    seasons: [season],
    activeSeasonId: season.id,
    entries: [],
    events: [],
    recurrings: [],
    customCategories: [],
    adherents: [],
    guardians: [],
    clubEvents: [],
    announcements: [],
    tournaments: [],
    trainingSessions: [],
    exercises: [],
    audit: [],
    settings: DEFAULT_SETTINGS,
    onboarded: true,
  };
}
