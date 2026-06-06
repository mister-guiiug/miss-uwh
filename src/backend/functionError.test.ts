import { describe, expect, it } from 'vitest';
import {
  functionErrorMessage,
  unwrapInvoke,
  type InvokeError,
} from './functionError.ts';

/** Simule le `Response` exposé par supabase-js sous `error.context`. */
function ctxJson(body: unknown): InvokeError {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: { json: async () => body },
  };
}

describe('functionErrorMessage', () => {
  it('préfère le message métier du corps (error.context.json)', async () => {
    const msg = await functionErrorMessage(ctxJson({ error: 'Slug inconnu' }));
    expect(msg).toBe('Slug inconnu');
  });

  it('retombe sur le message générique si le corps est illisible', async () => {
    const err: InvokeError = {
      message: 'générique',
      context: {
        json: async () => {
          throw new Error('not json');
        },
      },
    };
    expect(await functionErrorMessage(err)).toBe('générique');
  });

  it('retombe sur le message générique sans contexte', async () => {
    expect(await functionErrorMessage({ message: 'brut' })).toBe('brut');
  });

  it('ignore un corps dont `error` n’est pas une chaîne', async () => {
    const msg = await functionErrorMessage(ctxJson({ error: { code: 42 } }));
    expect(msg).toBe('Edge Function returned a non-2xx status code');
  });
});

describe('unwrapInvoke', () => {
  it('renvoie data quand tout va bien', async () => {
    const data = await unwrapInvoke({ data: { imported: 3 }, error: null });
    expect(data).toEqual({ imported: 3 });
  });

  it('lève le message métier sur erreur HTTP', async () => {
    await expect(
      unwrapInvoke({ data: null, error: ctxJson({ error: 'Quota dépassé' }) })
    ).rejects.toThrow('Quota dépassé');
  });

  it('lève une erreur applicative renvoyée en 200 (data.error)', async () => {
    await expect(
      unwrapInvoke({ data: { error: 'Formulaire introuvable' }, error: null })
    ).rejects.toThrow('Formulaire introuvable');
  });
});
