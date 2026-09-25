/**
 * Génération d'exercices d'entraînement par IA, côté navigateur (BYOK — la clé
 * de l'utilisateur, stockée sur l'appareil, appelle directement le fournisseur).
 *
 * Les fournisseurs, leurs en-têtes, leurs formats et leurs erreurs vivent dans
 * `shared/lib/aiClient.ts`, partagé avec la lecture des justificatifs. Il ne
 * reste ici que ce qui est propre aux exercices : le prompt et la lecture de la
 * réponse.
 *
 * Le prompt combine la « partie fixe pour tous » (config club synchronisée),
 * la « partie variable par utilisateur » (skills locaux) et la requête. La
 * sortie est un JSON strict, parsé défensivement en brouillons d'exercices.
 */
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  type AiSettings,
  type Exercise,
  type ExerciseCategory,
} from '../../shared/types/domain.ts';
import {
  callAi,
  describeAiError,
  extractJson,
} from '../../shared/lib/aiClient.ts';

// Réexportés : l'extraction a rejoint le client partagé (ses tests restent
// ici), et l'écran, qui charge ce module au geste, y trouve la traduction des
// erreurs sans importer le client lui-même.
export { describeAiError, extractJson };

/** Brouillon d'exercice généré (sans id ni saison — affectés au commit). */
export type GeneratedExercise = Omit<Exercise, 'id' | 'seasonId'>;

export interface GenerateRequest {
  /** Nombre d'exercices souhaités (borné 1–10). */
  count: number;
  /** Catégorie ciblée, ou « any » pour laisser l'IA varier. */
  category: ExerciseCategory | 'any';
  /** Niveau / public visé (texte libre, optionnel). */
  level?: string;
  /** Thème ou objectif de la séance (texte libre, optionnel). */
  theme?: string;
}

const MAX_TOKENS = 4096;

/** Prompt système : contrat de sortie + skills communs (fixes) + perso (variables). */
function buildSystemPrompt(ai: AiSettings, sharedSkills?: string): string {
  const cats = EXERCISE_CATEGORIES.map(
    c => `"${c}" (${EXERCISE_CATEGORY_LABELS[c]})`
  ).join(', ');
  const parts = [
    "Tu es un entraîneur expert de Hockey Subaquatique (Underwater Hockey, UWH), un sport d'équipe joué en apnée au fond d'une piscine. Tu génères des exercices d'entraînement (drills) concrets, sûrs et adaptés à l'apnée.",
    `Réponds STRICTEMENT et UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans bloc Markdown. Schéma : {"exercises":[{"name":string,"category":string,"durationMin":number,"level":string,"description":string}]}. "category" DOIT valoir l'une de : ${cats}. "durationMin" est un entier de minutes. "description" explique le déroulé, l'objectif et les consignes de sécurité apnée. Rédige en français.`,
  ];
  const shared = sharedSkills?.trim();
  if (shared) parts.push(`Contexte commun du club (à respecter) :\n${shared}`);
  const personal = ai.userSkills?.trim();
  if (personal) parts.push(`Préférences de l'entraîneur :\n${personal}`);
  return parts.join('\n\n');
}

function buildUserPrompt(req: GenerateRequest): string {
  const lines = [`Génère ${req.count} exercice(s) de Hockey Subaquatique.`];
  if (req.category !== 'any')
    lines.push(
      `Catégorie imposée : ${EXERCISE_CATEGORY_LABELS[req.category]}.`
    );
  else lines.push('Varie les catégories.');
  if (req.level?.trim()) lines.push(`Niveau / public : ${req.level.trim()}.`);
  if (req.theme?.trim()) lines.push(`Thème / objectif : ${req.theme.trim()}.`);
  return lines.join(' ');
}

const CATEGORY_SET = new Set<string>(EXERCISE_CATEGORIES);

function coerceCategory(value: unknown): ExerciseCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value)
    ? (value as ExerciseCategory)
    : 'technique';
}

/** Normalise un élément brut du modèle en brouillon d'exercice valide. */
function toDraft(raw: unknown): GeneratedExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return null;
  const duration =
    typeof r.durationMin === 'number' && Number.isFinite(r.durationMin)
      ? Math.max(1, Math.round(r.durationMin))
      : undefined;
  const level =
    typeof r.level === 'string' && r.level.trim() ? r.level.trim() : undefined;
  const description =
    typeof r.description === 'string' && r.description.trim()
      ? r.description.trim()
      : undefined;
  return {
    name,
    category: coerceCategory(r.category),
    ...(duration != null ? { durationMin: duration } : {}),
    ...(level ? { level } : {}),
    ...(description ? { description } : {}),
  };
}

/** Transforme le texte JSON du modèle en liste de brouillons d'exercices. */
export function parseExercises(text: string): GeneratedExercise[] {
  const parsed = extractJson(text);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { exercises?: unknown }).exercises)
      ? (parsed as { exercises: unknown[] }).exercises
      : [];
  const drafts = list
    .map(toDraft)
    .filter((d): d is GeneratedExercise => d !== null);
  if (drafts.length === 0)
    throw new Error('Aucun exercice exploitable dans la réponse IA.');
  return drafts;
}

/**
 * Génère des exercices via le fournisseur configuré. Lève une erreur lisible
 * en cas de clé manquante, d'échec réseau/HTTP ou de réponse non exploitable.
 */
export async function generateExercises(
  req: GenerateRequest,
  ai: AiSettings,
  sharedSkills?: string,
  signal?: AbortSignal
): Promise<GeneratedExercise[]> {
  const text = await callAi(
    ai,
    {
      system: buildSystemPrompt(ai, sharedSkills),
      user: buildUserPrompt(req),
      maxTokens: MAX_TOKENS,
    },
    signal
  );
  return parseExercises(text);
}
