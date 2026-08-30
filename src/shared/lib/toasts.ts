import { create } from 'zustand';

/**
 * Notifications éphémères (toasts) — la FILE.
 *
 * Store Zustand **séparé** de `useAppStore` : volontairement non persisté et
 * sans audit (ce sont des messages d'UI, pas des données métier). Placé dans
 * `shared/lib` (sans JSX) pour être appelable depuis du code bas-niveau —
 * `storage.ts`, couche de sync — via `useToasts.getState()`, sans dépendance à
 * la couche composant.
 *
 * C'est précisément pour cette raison que l'app ne prend PAS `ToastProvider` /
 * `useToast` de `dev-wpa-config/react/toast` : `useToast()` est un hook, donc
 * hors de portée de la persistance et de la synchro, qui sont les deux sources
 * de messages les plus importantes de cette app (« sauvegarde impossible »).
 * Le socle prévoit ce partage et publie sa zone d'affichage seule : l'app garde
 * sa file, `shared/components/ToastViewport.tsx` prend l'affichage et
 * l'accessibilité. Les règles de durée et de borne, elles, sont alignées sur
 * celles du socle.
 */
export type ToastTone = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Durée avant auto-fermeture (ms). `0` = persistant (l'utilisateur ferme). */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

/** Durée par défaut des messages non-bloquants. */
const AUTO_DISMISS_MS = 5000;

/**
 * Pile bornée (même borne que le socle). Au-delà, c'est le PLUS ANCIEN qui
 * cède : celui qui vient d'arriver n'a pas encore eu sa chance d'être lu.
 */
const MAX_TOASTS = 4;

/**
 * Les rebours en cours, hors du store : ce sont des minuteries, pas de l'état à
 * rendre. Chacune est éteinte quand son toast part, sinon un `setTimeout`
 * orphelin viendrait retirer un identifiant déjà réutilisé.
 */
interface Countdown {
  /** Millisecondes restantes au dernier départ. */
  remaining: number;
  startedAt: number;
  /** `null` pendant une suspension. */
  timer: ReturnType<typeof setTimeout> | null;
}
const countdowns = new Map<number, Countdown>();
let paused = false;

let nextId = 0;

function stopCountdown(id: number): void {
  const entry = countdowns.get(id);
  if (entry?.timer) clearTimeout(entry.timer);
  countdowns.delete(id);
}

function startCountdown(id: number, remaining: number): void {
  countdowns.set(id, {
    remaining,
    startedAt: Date.now(),
    timer: paused
      ? null
      : setTimeout(() => useToasts.getState().dismiss(id), remaining),
  });
}

export const useToasts = create<ToastState>(set => ({
  toasts: [],
  push: toast => {
    const id = ++nextId;
    set(s => {
      const next = [...s.toasts, { ...toast, id }];
      // La pile déborde par la tête — et les rebours abandonnés avec elle.
      for (const old of next.slice(0, Math.max(0, next.length - MAX_TOASTS))) {
        stopCountdown(old.id);
      }
      return { toasts: next.slice(-MAX_TOASTS) };
    });
    if (toast.duration > 0) startCountdown(id, toast.duration);
    return id;
  },
  dismiss: id => {
    stopCountdown(id);
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },
  clear: () => {
    for (const id of [...countdowns.keys()]) stopCountdown(id);
    set({ toasts: [] });
  },
}));

/**
 * Suspend — ou reprend — TOUS les rebours. Appelé par la zone d'affichage au
 * survol et au focus : sans cela, un message de cinq secondes s'efface sous la
 * souris de qui essaie de le lire (WCAG 2.2.1). Le temps déjà écoulé est
 * décompté, pas remis à zéro.
 */
export function setToastsPaused(value: boolean): void {
  if (paused === value) return;
  paused = value;
  for (const [id, entry] of countdowns) {
    if (value) {
      if (!entry.timer) continue;
      clearTimeout(entry.timer);
      countdowns.set(id, {
        remaining: Math.max(
          0,
          entry.remaining - (Date.now() - entry.startedAt)
        ),
        startedAt: Date.now(),
        timer: null,
      });
    } else if (!entry.timer) {
      startCountdown(id, entry.remaining);
    }
  }
}

/**
 * Erreur **persistante** (l'utilisateur doit la fermer) : adaptée aux risques de
 * perte de données. Déduplique les messages identiques pour ne pas spammer
 * (ex. échec d'écriture répété à chaque mutation).
 */
export function notifyError(message: string): number {
  const existing = useToasts
    .getState()
    .toasts.find(t => t.tone === 'error' && t.message === message);
  if (existing) return existing.id;
  return useToasts.getState().push({ tone: 'error', message, duration: 0 });
}

export function notifySuccess(message: string): number {
  return useToasts
    .getState()
    .push({ tone: 'success', message, duration: AUTO_DISMISS_MS });
}

export function notifyInfo(message: string): number {
  return useToasts
    .getState()
    .push({ tone: 'info', message, duration: AUTO_DISMISS_MS });
}
