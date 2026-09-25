/**
 * Le client d'IA partagé : ce qui part chez chaque fournisseur, et ce que
 * l'app fait de ce qui revient. Aucun appel réel — `fetch` est remplacé.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../types/domain.ts';
import { createTranslator } from '@mister-guiiug/dev-pwa-config/react/i18n';
import { messages } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/index.ts';
import {
  AiError,
  aiBaseUrl,
  aiHost,
  aiHttpError,
  anthropicRequest,
  buildAiRequest,
  callAi,
  describeAiError,
  extractJson,
  openAiRequest,
  readAiText,
  type AiPrompt,
} from './aiClient.ts';
import { AI_PROVIDER_ORIGINS, isAllowedAiEndpoint } from './aiOrigins.ts';

const anthropic: AiSettings = { provider: 'anthropic', apiKey: 'sk-ant' };
const openai: AiSettings = {
  provider: 'openai',
  apiKey: 'sk-oa',
  model: 'gpt-4o',
};

const withImage: AiPrompt = {
  system: 'Consigne',
  user: [
    { type: 'image', mediaType: 'image/jpeg', data: 'QUJD' },
    { type: 'text', text: 'Lis.' },
  ],
  maxTokens: 512,
};

const body = (init: { body: string }) => JSON.parse(init.body);

describe('aiBaseUrl / aiHost', () => {
  it('prend le point d’accès officiel à défaut, et la base personnalisée sans barre finale', () => {
    expect(aiBaseUrl(anthropic)).toBe('https://api.anthropic.com');
    expect(aiBaseUrl(openai)).toBe('https://api.openai.com/v1');
    expect(
      aiBaseUrl({ ...openai, baseUrl: ' https://openrouter.ai/api/v1/ ' })
    ).toBe('https://openrouter.ai/api/v1');
  });

  it('nomme l’hôte qui recevra les données', () => {
    expect(aiHost(anthropic)).toBe('api.anthropic.com');
    expect(aiHost({ ...openai, baseUrl: 'https://api.mistral.ai/v1' })).toBe(
      'api.mistral.ai'
    );
    // Une base illisible est rendue telle quelle plutôt que de lever.
    expect(aiHost({ ...openai, baseUrl: 'pas une url' })).toBe('pas une url');
  });
});

describe('anthropicRequest', () => {
  it('POST /v1/messages, en-têtes navigateur, image en bloc base64 AVANT le texte', () => {
    const { url, init } = anthropicRequest(anthropic, withImage);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({
      'x-api-key': 'sk-ant',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    expect(body(init)).toEqual({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      system: 'Consigne',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: 'QUJD',
              },
            },
            { type: 'text', text: 'Lis.' },
          ],
        },
      ],
    });
  });

  it('un PDF part en bloc `document`', () => {
    const { init } = anthropicRequest(anthropic, {
      system: 's',
      user: [{ type: 'pdf', data: 'JVBERi0' }],
      maxTokens: 10,
    });
    expect(body(init).messages[0].content[0]).toEqual({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: 'JVBERi0',
      },
    });
  });

  it('le texte seul reste une chaîne, et le modèle choisi est honoré', () => {
    const { init } = anthropicRequest(
      { ...anthropic, model: ' claude-sonnet-5 ' },
      { system: 's', user: 'Bonjour', maxTokens: 10 }
    );
    expect(body(init).messages[0].content).toBe('Bonjour');
    expect(body(init).model).toBe('claude-sonnet-5');
  });
});

describe('openAiRequest', () => {
  it('POST /chat/completions, Bearer, image en `image_url` data URL, JSON exigé', () => {
    const { url, init } = openAiRequest(openai, withImage);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    // La clé vient de la fixture : un littéral « Bearer … » passe pour un
    // secret aux yeux de VICE (vice/secrets/hardcoded-secret).
    expect(init.headers.authorization).toBe(`Bearer ${openai.apiKey}`);
    expect(body(init)).toEqual({
      model: 'gpt-4o',
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Consigne' },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,QUJD' },
            },
            { type: 'text', text: 'Lis.' },
          ],
        },
      ],
    });
  });

  it('exige un modèle', () => {
    expect(() =>
      openAiRequest({ provider: 'openai', apiKey: 'k' }, withImage)
    ).toThrow(expect.objectContaining({ code: 'no-model' }));
  });

  it('refuse un PDF, clairement', () => {
    expect(() =>
      openAiRequest(openai, {
        system: 's',
        user: [{ type: 'pdf', data: 'x' }],
        maxTokens: 1,
      })
    ).toThrow(expect.objectContaining({ code: 'pdf-unsupported' }));
  });

  it('buildAiRequest choisit le format du fournisseur configuré', () => {
    expect(buildAiRequest(anthropic, withImage).url).toMatch(/\/v1\/messages$/);
    expect(buildAiRequest(openai, withImage).url).toMatch(
      /\/chat\/completions$/
    );
  });
});

describe('readAiText', () => {
  it('Anthropic : les blocs de texte, joints', () => {
    expect(
      readAiText('anthropic', {
        content: [
          { type: 'text', text: '{"a":' },
          { type: 'tool_use' },
          { type: 'text', text: '1}' },
        ],
      })
    ).toBe('{"a":1}');
  });

  it('OpenAI : le premier choix', () => {
    expect(
      readAiText('openai', { choices: [{ message: { content: 'ok' } }] })
    ).toBe('ok');
  });

  it('une réponse sans contenu rend une chaîne vide, pas une exception', () => {
    expect(readAiText('anthropic', {})).toBe('');
    expect(readAiText('openai', null)).toBe('');
  });
});

describe('aiHttpError', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate'],
    [404, 'not-found'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [400, 'http'],
  ] as const)('HTTP %i → %s', (status, code) => {
    const error = aiHttpError(status, 'détail');
    expect(error.code).toBe(code);
    expect(error.params.status).toBe(status);
  });

  it('garde un extrait de la réponse pour les journaux', () => {
    expect(aiHttpError(400, '  modèle sans vision  ').message).toContain(
      'modèle sans vision'
    );
  });
});

describe('extractJson', () => {
  it('lit un bloc de code et du texte parasite', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Voici :\n{"a":1}\nVoilà.')).toEqual({ a: 1 });
  });

  it('une réponse illisible est une AiError « unreadable »', () => {
    expect(() => extractJson('rien')).toThrow(
      expect.objectContaining({ code: 'unreadable' })
    );
    expect(() => extractJson('{ pas du json }')).toThrow(AiError);
  });
});

describe('aiOrigins', () => {
  it('n’accepte que les origines de la CSP', () => {
    expect(isAllowedAiEndpoint('https://api.anthropic.com/v1/messages')).toBe(
      true
    );
    expect(
      isAllowedAiEndpoint('https://openrouter.ai/api/v1/chat/completions')
    ).toBe(true);
    expect(isAllowedAiEndpoint('https://evil.example/v1/messages')).toBe(false);
    // Même hôte, autre schéma : une autre origine.
    expect(isAllowedAiEndpoint('http://api.openai.com/v1')).toBe(false);
    expect(isAllowedAiEndpoint('pas une url')).toBe(false);
  });

  it('chaque origine est une origine nue, en https', () => {
    for (const origin of AI_PROVIDER_ORIGINS) {
      expect(new URL(origin).origin).toBe(origin);
      expect(origin.startsWith('https://')).toBe(true);
    }
  });
});

describe('callAi', () => {
  afterEach(() => vi.unstubAllGlobals());

  const prompt: AiPrompt = { system: 's', user: 'u', maxTokens: 1 };

  function stubFetch(response: unknown) {
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('sans clé, rien ne part', async () => {
    const fetchMock = stubFetch({});
    await expect(callAi({ provider: 'anthropic' }, prompt)).rejects.toThrow(
      expect.objectContaining({ code: 'no-key' })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un point d’accès hors de la CSP est refusé d’avance, et nommé', async () => {
    const fetchMock = stubFetch({});
    await expect(
      callAi({ ...openai, baseUrl: 'https://llm.interne.example/v1' }, prompt)
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'endpoint',
        params: { origin: 'https://llm.interne.example/v1' },
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un échec réseau devient une AiError « network »', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    await expect(callAi(anthropic, prompt)).rejects.toThrow(
      expect.objectContaining({ code: 'network' })
    );
  });

  it('un abandon voulu reste un abandon', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abort;
      })
    );
    await expect(callAi(anthropic, prompt, controller.signal)).rejects.toBe(
      abort
    );
  });

  it('un refus HTTP garde son code', async () => {
    stubFetch({ ok: false, status: 429, text: async () => 'trop' });
    await expect(callAi(anthropic, prompt)).rejects.toThrow(
      expect.objectContaining({ code: 'rate' })
    );
  });

  it('rend le texte de la réponse', async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"x":1}' } }] }),
    });
    await expect(callAi(openai, prompt)).resolves.toBe('{"x":1}');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('describeAiError', () => {
  const fr: Translate = createTranslator(messages, 'fr', 'fr');
  const en: Translate = createTranslator(messages, 'en', 'fr');

  it('traduit une AiError, avec ses paramètres', () => {
    const error = aiHttpError(418, '');
    expect(describeAiError(error, fr)).toBe(
      'Le fournisseur d’IA a refusé la requête (HTTP 418).'
    );
    expect(describeAiError(error, en)).toBe(
      'The AI provider rejected the request (HTTP 418).'
    );
  });

  it('chaque code a sa traduction, dans les deux langues', () => {
    const codes = [
      'no-key',
      'no-model',
      'endpoint',
      'network',
      'auth',
      'rate',
      'not-found',
      'unavailable',
      'http',
      'unreadable',
      'pdf-unsupported',
    ] as const;
    for (const code of codes) {
      const error = new AiError(code, '', { status: 400, origin: 'o' });
      // Le traducteur rend la CLÉ quand elle manque : c'est ce qui se voit.
      expect(describeAiError(error, fr)).not.toMatch(/^ai\.errors\./);
      expect(describeAiError(error, en)).not.toMatch(/^ai\.errors\./);
    }
  });

  it('laisse passer ce qui n’est pas une AiError', () => {
    expect(describeAiError(new Error('x'), fr)).toBeUndefined();
  });
});
