/**
 * Taxonomie comptable du club — décalquée du classeur Excel « Bilan comptable ».
 * Recettes R1..R9 + financier/compensé/régul. Dépenses D1..D13 + compensé/régul.
 *
 * Les codes sont STABLES : ils servent de clé de rattachement des écritures et de
 * cible de la migration depuis l'Excel (préfixe d'ORDRE, ex. « R8 Divers 3 »).
 */
import type { Category } from '../types/domain.ts';

/** Composantes tarifaires des inscriptions (règle 8). */
export const INSCRIPTION_COMPONENTS = [
  'adulte_plein',
  'adulte_reduit',
  'enfant',
  'assurance_loisir',
  'assurance_piscine',
  'assurance_perso',
  'licence',
  'aides',
  'pass_region',
  'parrainage',
] as const;

export const INSCRIPTION_COMPONENT_LABELS: Record<string, string> = {
  adulte_plein: 'Adulte plein tarif',
  adulte_reduit: 'Adulte tarif réduit',
  enfant: 'Enfant',
  assurance_loisir: 'Assurance loisir',
  assurance_piscine: 'Assurance piscine',
  assurance_perso: 'Assurance personnelle',
  licence: 'Licence',
  aides: 'Aides',
  pass_region: 'Pass Région',
  parrainage: 'Parrainage',
};

/** Composantes des licences FFESSM (D1). */
export const LICENCE_COMPONENTS = ['adulte', 'jeune', 'enfant', 'transfert'];
/** Composantes des assurances (D2). */
export const ASSURANCE_COMPONENTS = [
  'piscine',
  'loisirs1',
  'loisirs2',
  'loisirs3',
  'dirigeants',
];

export const COMPONENT_LABELS: Record<string, string> = {
  ...INSCRIPTION_COMPONENT_LABELS,
  adulte: 'Adulte',
  jeune: 'Jeune',
  transfert: 'Transfert',
  piscine: 'Piscine',
  loisirs1: 'Loisirs 1',
  loisirs2: 'Loisirs 2',
  loisirs3: 'Loisirs 3',
  dirigeants: 'Dirigeants',
};

export const CATEGORIES: Category[] = [
  // ── Recettes ────────────────────────────────────────────────────────
  {
    code: 'R1',
    label: 'Inscriptions / Cotisations',
    sens: 'recette',
    kind: 'exploitation',
    components: [...INSCRIPTION_COMPONENTS],
  },
  { code: 'R2', label: 'Subventions', sens: 'recette', kind: 'exploitation' },
  {
    code: 'R3',
    label: 'Remboursements FFESSM',
    sens: 'recette',
    kind: 'exploitation',
  },
  {
    code: 'R4',
    label: 'Stages France / Jeunes',
    sens: 'recette',
    kind: 'exploitation',
    eventCapable: true,
  },
  {
    code: 'R5',
    label: 'Tournoi des Arvernes — inscriptions',
    sens: 'recette',
    kind: 'exploitation',
    group: 'Tournoi des Arvernes',
    eventCapable: true,
  },
  {
    code: 'R6',
    label: 'Buvette TDA + CDF',
    sens: 'recette',
    kind: 'exploitation',
    eventCapable: true,
  },
  {
    code: 'R7',
    label: 'Vente de matériels',
    sens: 'recette',
    kind: 'exploitation',
  },
  {
    code: 'R8',
    label: 'Remboursement frais bancaires / Soutien asso',
    sens: 'recette',
    kind: 'exploitation',
  },
  {
    code: 'R9',
    label: 'Participations financières / déplacements',
    sens: 'recette',
    kind: 'exploitation',
    eventCapable: true,
  },
  {
    code: 'R-INT',
    label: 'Intérêts livret',
    sens: 'recette',
    kind: 'exploitation',
  },
  {
    code: 'R-COMP',
    label: 'Gratuité location piscine (compensée)',
    sens: 'recette',
    kind: 'compensee',
  },
  {
    code: 'R-REG',
    label: 'Régularisations (recette)',
    sens: 'recette',
    kind: 'regularisation',
  },

  // ── Dépenses ────────────────────────────────────────────────────────
  {
    code: 'D1',
    label: 'Licences FFESSM',
    sens: 'depense',
    kind: 'exploitation',
    components: LICENCE_COMPONENTS,
  },
  {
    code: 'D2',
    label: 'Assurances individuelles',
    sens: 'depense',
    kind: 'exploitation',
    components: ASSURANCE_COMPONENTS,
  },
  {
    code: 'D3',
    label: 'Affiliations FFESSM + AURA + OMS',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D4',
    label: 'Achat de matériels de hockey',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D5',
    label: 'Frais de déplacement',
    sens: 'depense',
    kind: 'exploitation',
    eventCapable: true,
  },
  {
    code: 'D6',
    label: 'Déplacements jeunes / stages / tournois',
    sens: 'depense',
    kind: 'exploitation',
    eventCapable: true,
  },
  {
    code: 'D7',
    label: 'Tournoi des Arvernes + Championnat',
    sens: 'depense',
    kind: 'exploitation',
    group: 'Tournoi des Arvernes',
    eventCapable: true,
  },
  {
    code: 'D8',
    label: 'Frais de bouche',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D9',
    label: 'Location matériels piscine + cartes',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D10',
    label: "Frais d'inscription compétitions",
    sens: 'depense',
    kind: 'exploitation',
    eventCapable: true,
  },
  {
    code: 'D11',
    label: 'Formation / recyclage',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D12',
    label: 'Divers / frais bancaires',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D13',
    label: 'Communication',
    sens: 'depense',
    kind: 'exploitation',
  },
  {
    code: 'D-COMP',
    label: 'Location piscine (compensée)',
    sens: 'depense',
    kind: 'compensee',
  },
  {
    code: 'D-REG',
    label: 'Régularisations (dépense)',
    sens: 'depense',
    kind: 'regularisation',
  },
];

const BY_CODE = new Map(CATEGORIES.map(c => [c.code, c]));

export function categoryByCode(code: string): Category | undefined {
  return BY_CODE.get(code);
}

export function categoryLabel(code: string): string {
  return BY_CODE.get(code)?.label ?? code;
}

export const RECETTE_CATEGORIES = CATEGORIES.filter(c => c.sens === 'recette');
export const DEPENSE_CATEGORIES = CATEGORIES.filter(c => c.sens === 'depense');
