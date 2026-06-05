import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyError, notifyInfo, notifySuccess, useToasts } from './toasts.ts';

describe('toasts', () => {
  beforeEach(() => {
    useToasts.getState().clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('push ajoute un toast et renvoie un id', () => {
    const id = useToasts
      .getState()
      .push({ tone: 'info', message: 'coucou', duration: 0 });
    const { toasts } = useToasts.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id, tone: 'info', message: 'coucou' });
  });

  it('dismiss retire le toast ciblé', () => {
    const a = notifyError('A');
    notifyError('B');
    useToasts.getState().dismiss(a);
    const messages = useToasts.getState().toasts.map(t => t.message);
    expect(messages).toEqual(['B']);
  });

  it('notifyError est persistant (aucune auto-fermeture)', () => {
    vi.useFakeTimers();
    notifyError('grave');
    vi.advanceTimersByTime(60_000);
    expect(useToasts.getState().toasts).toHaveLength(1);
  });

  it('notifyError déduplique les messages identiques', () => {
    const first = notifyError('même erreur');
    const second = notifyError('même erreur');
    expect(second).toBe(first);
    expect(useToasts.getState().toasts).toHaveLength(1);
  });

  it('notifySuccess / notifyInfo se ferment automatiquement', () => {
    vi.useFakeTimers();
    notifySuccess('ok');
    notifyInfo('fyi');
    expect(useToasts.getState().toasts).toHaveLength(2);
    vi.advanceTimersByTime(5000);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});
