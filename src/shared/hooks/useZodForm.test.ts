import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { z } from 'zod';
import { useZodForm } from './useZodForm.ts';

const schema = z
  .object({ name: z.string(), age: z.string() })
  .superRefine((v, ctx) => {
    if (!v.name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Nom requis.',
      });
    }
  })
  .transform(v => ({ name: v.name.trim(), age: Number(v.age) || 0 }));

const initial = { name: '', age: '' };

describe('useZodForm', () => {
  it('submit invalide : pose les erreurs et n’appelle pas onValid', () => {
    const onValid = vi.fn();
    const { result } = renderHook(() => useZodForm(schema, initial));
    act(() => result.current.submit(onValid));
    expect(onValid).not.toHaveBeenCalled();
    expect(result.current.errors.name).toBe('Nom requis.');
  });

  it('setValue efface l’erreur du champ corrigé', () => {
    const { result } = renderHook(() => useZodForm(schema, initial));
    act(() => result.current.submit(vi.fn()));
    expect(result.current.errors.name).toBe('Nom requis.');
    act(() => result.current.setValue('name', 'Marie'));
    expect(result.current.errors.name).toBeUndefined();
  });

  it('submit valide : appelle onValid avec la valeur parsée/transformée', () => {
    const onValid = vi.fn();
    const { result } = renderHook(() => useZodForm(schema, initial));
    act(() => result.current.setValue('name', '  Marie  '));
    act(() => result.current.setValue('age', '12'));
    act(() => result.current.submit(onValid));
    expect(onValid).toHaveBeenCalledWith({ name: 'Marie', age: 12 });
    expect(result.current.errors).toEqual({});
  });
});
