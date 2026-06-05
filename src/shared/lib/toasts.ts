import { create } from 'zustand';

/**
 * Notifications éphémères (toasts).
 *
 * Store Zustand **séparé** de `useAppStore` : volontairement non persisté et
 * sans audit (ce sont des messages d'UI, pas des données métier). Placé dans
 * `shared/lib` (sans JSX) pour être appelable depuis du code bas-niveau —
 * `storage.ts`, couche de sync — via `useToasts.getState()`, sans dépendance à
 * la couche composant.
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

let nextId = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: toast => {
    const id = ++nextId;
    set(s => ({ toasts: [...s.toasts, { ...toast, id }] }));
    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },
  dismiss: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Durée par défaut des messages non-bloquants. */
const AUTO_DISMISS_MS = 5000;

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
