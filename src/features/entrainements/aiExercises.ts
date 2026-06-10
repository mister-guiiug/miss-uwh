/**
 * Génération d'exercices d'entraînement par IA, côté navigateur (BYOK — la clé
 * de l'utilisateur, stockée sur l'appareil, appelle directement le fournisseur).
 *
 * Deux fournisseurs via `fetch` (pas de SDK : budget de bundle serré, et l'appel
 * direct navigateur exige de toute façon des en-têtes spécifiques) :
 *  - Anthropic  : POST /v1/messages (en-tête d'accès navigateur dédié) ;
 *  - OpenAI-compatible : POST /chat/completions (OpenAI, OpenRouter, Mistral…).
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

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

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

/** Message d'erreur lisible selon le code HTTP du fournisseur. */
function httpErrorMessage(status: number, raw: string): string {
  if (status === 401 || status === 403)
    return 'Clé API refusée. Vérifiez la clé dans Réglages → Génération IA.';
  if (status === 429)
    return 'Quota ou limite de débit atteint chez le fournisseur. Réessayez plus tard.';
  if (status === 404)
    return 'Modèle ou endpoint introuvable. Vérifiez le modèle et l’URL dans les Réglages.';
  if (status >= 500)
    return 'Le fournisseur d’IA est momentanément indisponible. Réessayez.';
  const snippet = raw.slice(0, 200).trim();
  return `Échec de la génération (HTTP ${status})${snippet ? ` : ${snippet}` : ''}.`;
}

async function callAnthropic(
  ai: AiSettings,
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<string> {
  const base = ai.baseUrl?.trim()
    ? trimSlash(ai.baseUrl.trim())
    : 'https://api.anthropic.com';
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': ai.apiKey ?? '',
      'anthropic-version': ANTHROPIC_VERSION,
      // Autorise l'appel direct depuis un navigateur (BYOK).
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ai.model?.trim() || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(httpErrorMessage(res.status, await res.text()));
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (data.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');
}

async function callOpenAi(
  ai: AiSettings,
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<string> {
  if (!ai.model?.trim())
    throw new Error(
      'Indiquez un modèle (ex. « gpt-4o ») dans Réglages → Génération IA.'
    );
  const base = ai.baseUrl?.trim()
    ? trimSlash(ai.baseUrl.trim())
    : 'https://api.openai.com/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ai.apiKey ?? ''}`,
    },
    body: JSON.stringify({
      model: ai.model.trim(),
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(httpErrorMessage(res.status, await res.text()));
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Extrait l'objet JSON d'une réponse modèle, tolérant aux clôtures Markdown
 * (```json) et au texte parasite avant/après.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1]! : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    // Repli : du premier { (ou [) jusqu'au dernier } (ou ]).
    const start = candidate.search(/[{[]/);
    const end = Math.max(
      candidate.lastIndexOf('}'),
      candidate.lastIndexOf(']')
    );
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Réponse IA illisible (JSON attendu).');
  }
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
  if (!ai.apiKey?.trim())
    throw new Error(
      'Aucune clé API configurée. Renseignez-la dans Réglages → Génération IA.'
    );
  const system = buildSystemPrompt(ai, sharedSkills);
  const user = buildUserPrompt(req);
  const text =
    ai.provider === 'anthropic'
      ? await callAnthropic(ai, system, user, signal)
      : await callOpenAi(ai, system, user, signal);
  return parseExercises(text);
}
