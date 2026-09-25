/**
 * Appel d'un fournisseur d'IA depuis le navigateur, avec la clé de
 * l'utilisateur (BYOK — stockée sur l'appareil, jamais synchronisée). PARTAGÉ
 * par la génération d'exercices et la lecture des justificatifs : les deux
 * fournisseurs, leurs en-têtes, leurs formats et leurs erreurs ne s'écrivent
 * qu'une fois.
 *
 *  - Anthropic : POST /v1/messages, avec l'en-tête d'accès navigateur dédié ;
 *  - OpenAI-compatible : POST /chat/completions (OpenAI, OpenRouter, Mistral…).
 *
 * `fetch` nu, sans SDK : budget de bundle serré, et l'appel direct navigateur
 * exige de toute façon ces en-têtes-là.
 *
 * LES ERREURS ONT UN CODE. L'écran traduit le code (i18n FR/EN, cf.
 * `describeAiError`) ; le message français reste pour les journaux et pour les
 * appelants qui l'affichaient déjà.
 */
import type { AiProvider, AiSettings } from '../types/domain.ts';
import type { TKey, Translate } from '../../i18n/index.ts';
import { isAllowedAiEndpoint } from './aiOrigins.ts';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';
const ANTHROPIC_VERSION = '2023-06-01';

export type AiErrorCode =
  | 'no-key'
  | 'no-model'
  | 'endpoint'
  | 'network'
  | 'auth'
  | 'rate'
  | 'not-found'
  | 'unavailable'
  | 'http'
  | 'unreadable'
  | 'pdf-unsupported';

export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Valeurs interpolées dans le message traduit (`status`, `origin`). */
  readonly params: Record<string, string | number>;

  constructor(
    code: AiErrorCode,
    message: string,
    params: Record<string, string | number> = {}
  ) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.params = params;
  }
}

/**
 * Un morceau du message de l'utilisateur. `data` est du base64 SANS le préfixe
 * `data:` : chaque fournisseur l'emballe à sa façon.
 */
export type AiPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string }
  | { type: 'pdf'; data: string };

export interface AiPrompt {
  system: string;
  /**
   * Du texte seul, ou des morceaux. Pour une image, la mettre AVANT le texte :
   * c'est l'ordre que recommande Anthropic.
   */
  user: string | readonly AiPart[];
  maxTokens: number;
}

/** Une requête prête pour `fetch` — séparée de l'appel pour être testée. */
export interface AiRequest {
  url: string;
  init: { method: 'POST'; headers: Record<string, string>; body: string };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** La base de l'API du fournisseur configuré (URL personnalisée comprise). */
export function aiBaseUrl(ai: AiSettings): string {
  const custom = ai.baseUrl?.trim();
  if (custom) return trimSlash(custom);
  return ai.provider === 'anthropic'
    ? 'https://api.anthropic.com'
    : 'https://api.openai.com/v1';
}

/** L'hôte qui recevra les données — ce que la note de confidentialité nomme. */
export function aiHost(ai: AiSettings): string {
  try {
    return new URL(aiBaseUrl(ai)).host;
  } catch {
    return aiBaseUrl(ai);
  }
}

function anthropicContent(user: AiPrompt['user']) {
  if (typeof user === 'string') return user;
  return user.map(part => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'image':
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.mediaType,
            data: part.data,
          },
        };
      case 'pdf':
        return {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: part.data,
          },
        };
    }
  });
}

/** POST /v1/messages : bloc `image` (ou `document`) en base64. */
export function anthropicRequest(ai: AiSettings, prompt: AiPrompt): AiRequest {
  return {
    url: `${aiBaseUrl(ai)}/v1/messages`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ai.apiKey ?? '',
        'anthropic-version': ANTHROPIC_VERSION,
        // Autorise l'appel direct depuis un navigateur (BYOK).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: ai.model?.trim() || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: prompt.maxTokens,
        system: prompt.system,
        messages: [{ role: 'user', content: anthropicContent(prompt.user) }],
      }),
    },
  };
}

function openAiContent(user: AiPrompt['user']) {
  if (typeof user === 'string') return user;
  return user.map(part => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'image':
        return {
          type: 'image_url',
          image_url: { url: `data:${part.mediaType};base64,${part.data}` },
        };
      case 'pdf':
        // L'API compatible ne garantit pas la lecture des PDF (chaque
        // fournisseur fait à sa façon) : refusé ici, clairement, plutôt
        // qu'envoyé pour une erreur obscure.
        throw new AiError(
          'pdf-unsupported',
          'Ce fournisseur ne lit pas les PDF : seul Claude (Anthropic) le fait ici.'
        );
    }
  });
}

/** POST /chat/completions : `image_url` en data URL, sortie JSON demandée. */
export function openAiRequest(ai: AiSettings, prompt: AiPrompt): AiRequest {
  const model = ai.model?.trim();
  if (!model)
    throw new AiError(
      'no-model',
      'Indiquez un modèle (ex. « gpt-4o ») dans Réglages → Génération IA.'
    );
  return {
    url: `${aiBaseUrl(ai)}/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ai.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: prompt.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: openAiContent(prompt.user) },
        ],
      }),
    },
  };
}

export function buildAiRequest(ai: AiSettings, prompt: AiPrompt): AiRequest {
  return ai.provider === 'anthropic'
    ? anthropicRequest(ai, prompt)
    : openAiRequest(ai, prompt);
}

/** Le texte de la réponse, selon le format du fournisseur. */
export function readAiText(provider: AiProvider, json: unknown): string {
  if (provider === 'anthropic') {
    const content = (json as { content?: { type: string; text?: string }[] })
      ?.content;
    return (content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('');
  }
  return (
    (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
      ?.message?.content ?? ''
  );
}

/** Erreur lisible selon le code HTTP du fournisseur. */
export function aiHttpError(status: number, raw: string): AiError {
  if (status === 401 || status === 403)
    return new AiError(
      'auth',
      'Clé API refusée. Vérifiez la clé dans Réglages → Génération IA.',
      { status }
    );
  if (status === 429)
    return new AiError(
      'rate',
      'Quota ou limite de débit atteint chez le fournisseur. Réessayez plus tard.',
      { status }
    );
  if (status === 404)
    return new AiError(
      'not-found',
      'Modèle ou endpoint introuvable. Vérifiez le modèle et l’URL dans les Réglages.',
      { status }
    );
  if (status >= 500)
    return new AiError(
      'unavailable',
      'Le fournisseur d’IA est momentanément indisponible. Réessayez.',
      { status }
    );
  const snippet = raw.slice(0, 200).trim();
  return new AiError(
    'http',
    `Échec de l’appel au fournisseur d’IA (HTTP ${status})${snippet ? ` : ${snippet}` : ''}.`,
    { status }
  );
}

/**
 * Appelle le fournisseur configuré et rend le TEXTE de sa réponse. Lève une
 * `AiError` : clé absente, point d'accès hors de la CSP, réseau, HTTP.
 */
export async function callAi(
  ai: AiSettings,
  prompt: AiPrompt,
  signal?: AbortSignal
): Promise<string> {
  if (!ai.apiKey?.trim())
    throw new AiError(
      'no-key',
      'Aucune clé API configurée. Renseignez-la dans Réglages → Génération IA.'
    );
  const request = buildAiRequest(ai, prompt);
  if (!isAllowedAiEndpoint(request.url)) {
    const origin = aiBaseUrl(ai);
    throw new AiError(
      'endpoint',
      `Point d’accès non autorisé par la politique de sécurité de l’app : ${origin}.`,
      { origin }
    );
  }
  let res: Response;
  try {
    res = await fetch(request.url, { ...request.init, signal });
  } catch (error) {
    // Un abandon voulu reste un abandon : l'appelant le reconnaît.
    if (signal?.aborted) throw error;
    throw new AiError(
      'network',
      'Fournisseur d’IA injoignable : vérifiez la connexion.'
    );
  }
  if (!res.ok) throw aiHttpError(res.status, await res.text());
  return readAiText(ai.provider, await res.json());
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
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* illisible : l'erreur à code ci-dessous le dit */
      }
    }
    throw new AiError('unreadable', 'Réponse IA illisible (JSON attendu).');
  }
}

const AI_ERROR_KEYS: Record<AiErrorCode, TKey> = {
  'no-key': 'ai.errors.noKey',
  'no-model': 'ai.errors.noModel',
  endpoint: 'ai.errors.endpoint',
  network: 'ai.errors.network',
  auth: 'ai.errors.auth',
  rate: 'ai.errors.rate',
  'not-found': 'ai.errors.notFound',
  unavailable: 'ai.errors.unavailable',
  http: 'ai.errors.http',
  unreadable: 'ai.errors.unreadable',
  'pdf-unsupported': 'ai.errors.pdfUnsupported',
};

/** Le message TRADUIT d'une `AiError` ; `undefined` pour toute autre erreur. */
export function describeAiError(
  error: unknown,
  t: Translate
): string | undefined {
  if (!(error instanceof AiError)) return undefined;
  return t(AI_ERROR_KEYS[error.code], error.params);
}
