import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  extractJson,
  generateExercises,
  parseExercises,
  type GenerateRequest,
} from './aiExercises.ts';
import type { AiSettings } from '../../shared/types/domain.ts';

describe('extractJson', () => {
  it('parse un JSON nu', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('tolère une clôture Markdown ```json', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('tolère du texte parasite avant/après', () => {
    expect(extractJson('Voici :\n{"a":1}\nVoilà.')).toEqual({ a: 1 });
  });

  it('lève si aucun JSON', () => {
    expect(() => extractJson('pas de json ici')).toThrow();
  });
});

describe('parseExercises', () => {
  it('accepte la forme {exercises:[…]} et normalise', () => {
    const out = parseExercises(
      JSON.stringify({
        exercises: [
          {
            name: 'Passes en triangle',
            category: 'technique',
            durationMin: 12.6,
            level: 'Loisir',
            description: 'Déroulé…',
          },
        ],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: 'Passes en triangle',
      category: 'technique',
      durationMin: 13, // arrondi
      level: 'Loisir',
    });
  });

  it('accepte un tableau nu', () => {
    const out = parseExercises(
      '[{"name":"Sprint apnée","category":"physique"}]'
    );
    expect(out[0]!.name).toBe('Sprint apnée');
    expect(out[0]!.durationMin).toBeUndefined();
  });

  it('rabat une catégorie inconnue sur « technique »', () => {
    const out = parseExercises('[{"name":"X","category":"inventée"}]');
    expect(out[0]!.category).toBe('technique');
  });

  it('ignore les éléments sans nom', () => {
    const out = parseExercises(
      '[{"category":"jeu"},{"name":"OK","category":"jeu"}]'
    );
    expect(out).toHaveLength(1);
  });

  it('lève si aucun exercice exploitable', () => {
    expect(() => parseExercises('{"exercises":[]}')).toThrow();
  });
});

describe('generateExercises', () => {
  const req: GenerateRequest = { count: 2, category: 'any' };
  const anthropic: AiSettings = { provider: 'anthropic', apiKey: 'sk-test' };

  afterEach(() => vi.unstubAllGlobals());

  it('lève (sans appel réseau) si la clé manque', async () => {
    await expect(
      generateExercises(req, { provider: 'anthropic' })
    ).rejects.toThrow(/clé API/i);
  });

  it('Anthropic : envoie les bons en-têtes et parse content[].text', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"exercises":[{"name":"A","category":"jeu"}]}',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const out = await generateExercises(req, anthropic, 'Niveau N2');
    expect(out[0]!.name).toBe('A');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('claude-opus-4-8'); // défaut
    expect(body.system).toContain('Niveau N2'); // skills communs injectés
  });

  it('OpenAI : exige un modèle', async () => {
    await expect(
      generateExercises(req, { provider: 'openai', apiKey: 'sk' })
    ).rejects.toThrow(/modèle/i);
  });

  it('OpenAI : Bearer + parse choices[0].message.content', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"exercises":[{"name":"B","category":"gardien"}]}',
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const out = await generateExercises(req, {
      provider: 'openai',
      apiKey: 'sk',
      model: 'gpt-4o',
    });
    expect(out[0]!.category).toBe('gardien');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk');
  });

  it('mappe une 401 sur un message lisible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'nope',
      })) as unknown as typeof fetch
    );
    await expect(generateExercises(req, anthropic)).rejects.toThrow(/refusée/i);
  });
});
