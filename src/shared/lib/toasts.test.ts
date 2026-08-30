import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  setToastsPaused,
  useToasts,
} from './toasts.ts';

describe('toasts', () => {
  beforeEach(() => {
    useToasts.getState().clear();
    setToastsPaused(false);
  });
  afterEach(() => {
    setToastsPaused(false);
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

  it('borne la pile en laissant partir le plus ancien', () => {
    for (const n of [1, 2, 3, 4, 5]) notifyError(`erreur ${n}`);

    const messages = useToasts.getState().toasts.map(t => t.message);
    expect(messages).toEqual(['erreur 2', 'erreur 3', 'erreur 4', 'erreur 5']);
  });

  it('suspend le rebours au survol, et reprend là où il s’était arrêté', () => {
    vi.useFakeTimers();
    notifySuccess('à lire');

    vi.advanceTimersByTime(2000); // 3 s restantes
    setToastsPaused(true); // la souris arrive sur la pile

    vi.advanceTimersByTime(60_000);
    expect(useToasts.getState().toasts).toHaveLength(1); // rien ne s'efface

    setToastsPaused(false); // la souris repart
    vi.advanceTimersByTime(2999);
    expect(useToasts.getState().toasts).toHaveLength(1); // le reste, pas plus
    vi.advanceTimersByTime(1);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('n’efface plus rien après un clear (pas de minuterie orpheline)', () => {
    vi.useFakeTimers();
    notifySuccess('éphémère');
    useToasts.getState().clear();
    notifyError('la suivante');

    vi.advanceTimersByTime(10_000);

    expect(useToasts.getState().toasts.map(t => t.message)).toEqual([
      'la suivante',
    ]);
  });
});
