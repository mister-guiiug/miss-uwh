/**
 * Registre déclaratif des « Lens » (espaces fonctionnels du club). Source unique
 * de vérité : la navigation (lanceur d'accueil, barre du bas, en-tête) et le
 * contrôle d'accès en dérivent. Ajouter un lens plus tard = ajouter une entrée
 * ici + ses écrans/routes.
 */
import {
  BookOpenText,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartPie,
  Coins,
  Dumbbell,
  Flag,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  PartyPopper,
  ScrollText,
  Target,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../auth/useAuth.ts';
import { IS_SUPABASE } from '../../backend/config.ts';

export interface LensTab {
  /** Chemin RELATIF au préfixe du lens. '' = l'écran d'index du lens. */
  to: string;
  label: string;
  Icon: LucideIcon;
  /** `end` de NavLink. Défaut : vrai quand `to === ''`. */
  end?: boolean;
}

export interface Lens {
  /** Préfixe d'URL + clé stable, ex. 'finances'. */
  id: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  /** Couleur d'accent (token CSS ou hex), appliquée en style inline. */
  accent: string;
  /** Rôles autorisés (au moins un). Undefined = tout membre authentifié. */
  roles?: Role[];
  tabs: LensTab[];
}

export const LENSES: Lens[] = [
  {
    id: 'finances',
    label: 'Finances',
    description: 'Bilan, journal comptable, catégories et saisons.',
    Icon: Wallet,
    accent: 'var(--color-primary)',
    roles: ['tresorier', 'tresorier_adjoint', 'president', 'controleur'],
    tabs: [
      { to: '', label: 'Bilan', Icon: LayoutGrid, end: true },
      { to: 'journal', label: 'Journal', Icon: ScrollText },
      { to: 'categories', label: 'Catégories', Icon: BookOpenText },
      { to: 'synthese', label: 'Synthèse', Icon: ChartPie },
      { to: 'seasons', label: 'Saisons', Icon: CalendarRange },
    ],
  },
  {
    id: 'adherents',
    label: 'Adhérents',
    description: 'Membres, familles, encadrement et cotisations.',
    Icon: Users,
    accent: '#7c5fbf',
    roles: ['president', 'secretaire', 'tresorier'],
    tabs: [
      { to: '', label: 'Membres', Icon: Users, end: true },
      { to: 'familles', label: 'Familles', Icon: Heart },
      { to: 'encadrement', label: 'Encadrement', Icon: GraduationCap },
      { to: 'cotisations', label: 'Cotisations', Icon: Coins },
    ],
  },
  {
    id: 'entrainements',
    label: 'Entraînements',
    description: 'Séances, exercices, stratégie et arbitrage.',
    Icon: Dumbbell,
    accent: '#1f9d55',
    roles: ['entraineur', 'president'],
    tabs: [
      { to: '', label: 'Séances', Icon: CalendarClock, end: true },
      { to: 'exercices', label: 'Exercices', Icon: Dumbbell },
      { to: 'strategie', label: 'Stratégie', Icon: Target },
      { to: 'arbitrage', label: 'Arbitrage', Icon: Flag },
    ],
  },
  {
    id: 'vie-club',
    label: 'Vie du club',
    description: 'Événements, tournois, annonces et galerie.',
    Icon: PartyPopper,
    accent: '#e8833a',
    roles: ['resp_evenement', 'president'],
    tabs: [
      { to: '', label: 'Événements', Icon: CalendarDays, end: true },
      { to: 'tournois', label: 'Tournois', Icon: Trophy },
      { to: 'annonces', label: 'Annonces', Icon: Megaphone },
      { to: 'galerie', label: 'Galerie', Icon: ImageIcon },
    ],
  },
];

export function lensById(id: string | undefined): Lens | undefined {
  return LENSES.find(l => l.id === id);
}

/**
 * Contrôle d'accès. En mode LOCAL (utilisateur unique, pas d'auth) tout est
 * accessible. En mode Supabase : admin = superuser ; un lens sans `roles` est
 * public (tout membre) ; sinon il faut au moins un des rôles requis.
 */
export function canAccessLens(roles: Role[], lens: Lens): boolean {
  if (!IS_SUPABASE) return true;
  if (roles.includes('admin_technique')) return true;
  if (!lens.roles || lens.roles.length === 0) return true;
  return lens.roles.some(r => roles.includes(r));
}

/** Lens visibles pour un utilisateur, dans l'ordre déclaré. */
export function accessibleLenses(roles: Role[]): Lens[] {
  return LENSES.filter(l => canAccessLens(roles, l));
}
