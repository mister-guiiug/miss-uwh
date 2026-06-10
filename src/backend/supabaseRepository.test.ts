import { beforeEach, describe, expect, it, vi } from 'vitest';

// On mocke UNIQUEMENT la couche Supabase : `from().select().limit()` résout
// `{ data, error }` qu'on pilote par test. Les mappers restent réels (purs).
const result: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock('../lib/supabase.ts', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ limit: () => Promise.resolve(result) }),
    }),
  }),
}));

import { fetchAiConfig, isMissingTableError } from './supabaseRepository.ts';

beforeEach(() => {
  result.data = null;
  result.error = null;
});

describe('isMissingTableError', () => {
  it('détecte le code PostgREST PGRST205', () => {
    expect(isMissingTableError({ code: 'PGRST205' })).toBe(true);
  });
  it('détecte le message « schema cache » / « could not find the table »', () => {
    expect(
      isMissingTableError({
        message:
          "Could not find the table 'public.ai_config' in the schema cache",
      })
    ).toBe(true);
  });
  it('ignore les autres erreurs (RLS, etc.)', () => {
    expect(
      isMissingTableError({ code: '42501', message: 'permission denied' })
    ).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});

describe('fetchAiConfig', () => {
  it('table absente (migration non appliquée) → null sans lever', async () => {
    result.error = {
      code: 'PGRST205',
      message:
        "Could not find the table 'public.ai_config' in the schema cache",
    };
    await expect(fetchAiConfig()).resolves.toBeNull();
  });

  it('ligne présente → mappée', async () => {
    result.data = [
      { club_id: 'c1', shared_skills: 'Contexte commun', updated_at: null },
    ];
    const out = await fetchAiConfig();
    expect(out?.sharedSkills).toBe('Contexte commun');
  });

  it('aucune ligne → null', async () => {
    result.data = [];
    await expect(fetchAiConfig()).resolves.toBeNull();
  });

  it('autre erreur (ex. RLS) → propagée (ne masque pas les vraies erreurs)', async () => {
    result.error = { code: '42501', message: 'permission denied' };
    await expect(fetchAiConfig()).rejects.toThrow(/permission denied/);
  });
});
