import type {
  Category,
  EventLedger,
  RecurringTemplate,
} from '../../shared/types/domain.ts';
import { createUuid } from '../../shared/lib/id.ts';
import { categoryByCode } from '../../shared/lib/categories.ts';
import type { FinanceActions, StoreSlice } from '../types.ts';
import { commitAudited, commitPlain, remote } from '../storeHelpers.ts';

/**
 * Comptabilité « périphérique » : événements (regroupement d'écritures),
 * modèles récurrents et catégories personnalisées. Les écritures elles-mêmes
 * sont dans `entriesSlice`.
 */
export const createFinanceSlice: StoreSlice<FinanceActions> = (set, get) => ({
  addEvent: (name, kind) => {
    const ev: EventLedger = {
      id: createUuid(),
      seasonId: get().data.activeSeasonId,
      name,
      kind,
    };
    set(s => ({
      data: commitAudited(
        { ...s.data, events: [...s.data.events, ev] },
        {
          action: 'event.create',
          category: 'metier',
          target: 'event',
          summary: `Création de l'événement « ${name} ».`,
          targetId: ev.id,
        }
      ),
    }));
    remote({ kind: 'event.upsert', event: ev });
    return ev.id;
  },

  updateEvent: (id, patch) =>
    set(s => {
      const ev = s.data.events.find(e => e.id === id);
      if (!ev) return s;
      const updated: EventLedger = { ...ev, ...patch };
      remote({ kind: 'event.upsert', event: updated });
      return {
        data: commitPlain({
          ...s.data,
          events: s.data.events.map(e => (e.id === id ? updated : e)),
        }),
      };
    }),

  deleteEvent: id =>
    set(s => {
      const ev = s.data.events.find(e => e.id === id);
      if (!ev) return s;
      // Détache les écritures rattachées (sans les supprimer) puis retire
      // l'événement. Côté serveur, la FK `on delete set null` détache aussi.
      const entries = s.data.entries.map(e =>
        e.eventId === id ? { ...e, eventId: undefined } : e
      );
      remote({ kind: 'event.delete', id });
      return {
        data: commitAudited(
          {
            ...s.data,
            entries,
            events: s.data.events.filter(e => e.id !== id),
          },
          {
            action: 'event.delete',
            category: 'metier',
            target: 'event',
            summary: `Suppression de l'événement « ${ev.name} » (écritures détachées).`,
            targetId: id,
          }
        ),
      };
    }),

  addRecurring: t => {
    // UUID : id local = clé primaire Postgres (upsert idempotent).
    const tpl: RecurringTemplate = { ...t, id: createUuid() };
    set(s => ({
      data: commitPlain({ ...s.data, recurrings: [...s.data.recurrings, tpl] }),
    }));
    remote({ kind: 'recurring.upsert', recurring: tpl });
    return tpl.id;
  },

  deleteRecurring: id =>
    set(s => {
      remote({ kind: 'recurring.delete', id });
      return {
        data: commitPlain({
          ...s.data,
          recurrings: s.data.recurrings.filter(r => r.id !== id),
        }),
      };
    }),

  generateFromRecurring: (id, date) => {
    const { data } = get();
    const tpl = data.recurrings.find(r => r.id === id);
    if (!tpl) return null;
    const cat = categoryByCode(tpl.categoryCode);
    const sens = cat?.sens === 'depense' ? 'debit' : 'credit';
    return get().addEntry({
      seasonId: data.activeSeasonId,
      categoryCode: tpl.categoryCode,
      date,
      label: tpl.label,
      sens,
      amount: tpl.amount,
      method: tpl.method,
    });
  },

  addCustomCategory: input => {
    const existing = new Set([
      ...get().data.customCategories.map(c => c.code),
      // codes réservés type C1, C2…
    ]);
    let n = get().data.customCategories.length + 1;
    let code = `C${n}`;
    while (existing.has(code)) code = `C${++n}`;
    const cat: Category = {
      code,
      label: input.label,
      sens: input.sens,
      kind: input.kind ?? 'exploitation',
    };
    set(s => ({
      data: commitAudited(
        { ...s.data, customCategories: [...s.data.customCategories, cat] },
        {
          action: 'category.create',
          category: 'metier',
          target: 'category',
          summary: `Catégorie personnalisée « ${input.label} » (${code}).`,
          targetId: code,
        }
      ),
    }));
    remote({ kind: 'category.upsert', category: cat });
    return code;
  },

  removeCustomCategory: code =>
    set(s => {
      remote({ kind: 'category.delete', code });
      return {
        data: commitPlain({
          ...s.data,
          customCategories: s.data.customCategories.filter(
            c => c.code !== code
          ),
        }),
      };
    }),
});
