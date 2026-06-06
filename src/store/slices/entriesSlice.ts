import type { JournalEntry } from '../../shared/types/domain.ts';
import { createUuid } from '../../shared/lib/id.ts';
import type { EntriesActions, StoreSlice } from '../types.ts';
import {
  commitAudited,
  getCurrentActor,
  isLocked,
  remote,
} from '../storeHelpers.ts';

/**
 * Écritures du journal : cœur comptable. Toutes les mutations respectent le
 * verrou de clôture (`isLocked`) ; les suppressions sont logiques (`deletedAt`).
 */
export const createEntriesSlice: StoreSlice<EntriesActions> = (set, get) => ({
  addEntry: input => {
    const data = get().data;
    if (isLocked(data, input.seasonId)) {
      console.warn('[miss-uwh] saison verrouillée : création refusée');
      return null;
    }
    const now = Date.now();
    const actor = getCurrentActor();
    const entry: JournalEntry = {
      ...input,
      id: createUuid(),
      attachments: [],
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: actor,
      version: 1,
    };
    set(s => ({
      data: commitAudited(
        { ...s.data, entries: [...s.data.entries, entry] },
        {
          action: 'entry.create',
          category: 'metier',
          target: 'entry',
          summary: `Écriture « ${entry.label} » (${entry.sens === 'credit' ? '+' : '−'}${entry.amount.toFixed(2)} €, ${entry.categoryCode}).`,
          targetId: entry.id,
          after: entry,
        }
      ),
    }));
    remote({ kind: 'entry.upsert', entry });
    return entry.id;
  },

  importEntries: drafts => {
    const data = get().data;
    const now = Date.now();
    const actor = getCurrentActor();
    const accepted = drafts.filter(d => !isLocked(data, d.seasonId));
    const created: JournalEntry[] = accepted.map((d, i) => ({
      ...d,
      id: createUuid(),
      attachments: [],
      createdAt: now + i,
      createdBy: actor,
      updatedAt: now + i,
      updatedBy: actor,
      version: 1,
    }));
    set(s => ({
      data: commitAudited(
        { ...s.data, entries: [...s.data.entries, ...created] },
        {
          action: 'data.import.entries',
          category: 'securite',
          target: 'app',
          summary: `Import de ${created.length} écriture(s) depuis un fichier externe.`,
        }
      ),
    }));
    remote({ kind: 'entry.bulkUpsert', entries: created });
    return created.length;
  },

  updateEntry: (id, patch) =>
    set(s => {
      const before = s.data.entries.find(e => e.id === id);
      if (!before || isLocked(s.data, before.seasonId)) return s;
      const after: JournalEntry = {
        ...before,
        ...patch,
        updatedAt: Date.now(),
        updatedBy: getCurrentActor(),
        version: before.version + 1,
      };
      remote({ kind: 'entry.upsert', entry: after });
      return {
        data: commitAudited(
          {
            ...s.data,
            entries: s.data.entries.map(e => (e.id === id ? after : e)),
          },
          {
            action: 'entry.update',
            category: 'metier',
            target: 'entry',
            summary: `Modification de l'écriture « ${after.label} » (v${after.version}).`,
            targetId: id,
            before,
            after,
          }
        ),
      };
    }),

  setReconciled: (id, reconciled) =>
    set(s => {
      const before = s.data.entries.find(e => e.id === id);
      if (!before || isLocked(s.data, before.seasonId)) return s;
      const after: JournalEntry = {
        ...before,
        reconciled,
        reconciledAt: reconciled ? Date.now() : undefined,
        updatedAt: Date.now(),
        updatedBy: getCurrentActor(),
        version: before.version + 1,
      };
      remote({ kind: 'entry.upsert', entry: after });
      return {
        data: commitAudited(
          {
            ...s.data,
            entries: s.data.entries.map(e => (e.id === id ? after : e)),
          },
          {
            action: 'entry.reconcile',
            category: 'metier',
            target: 'entry',
            summary: `Écriture « ${before.label} » ${reconciled ? 'pointée' : 'dépointée'} (rapprochement).`,
            targetId: id,
          }
        ),
      };
    }),

  softDeleteEntry: (id, reason) =>
    set(s => {
      const before = s.data.entries.find(e => e.id === id);
      if (!before || before.deletedAt || isLocked(s.data, before.seasonId))
        return s;
      const after: JournalEntry = {
        ...before,
        deletedAt: Date.now(),
        deletedBy: getCurrentActor(),
        observation: reason
          ? `${before.observation ? before.observation + ' — ' : ''}Suppression : ${reason}`
          : before.observation,
        version: before.version + 1,
      };
      remote({ kind: 'entry.upsert', entry: after });
      return {
        data: commitAudited(
          {
            ...s.data,
            entries: s.data.entries.map(e => (e.id === id ? after : e)),
          },
          {
            action: 'entry.delete',
            category: 'securite',
            target: 'entry',
            summary: `Suppression logique de « ${before.label} »${reason ? ` — motif : ${reason}` : ''}.`,
            targetId: id,
            before,
          }
        ),
      };
    }),

  restoreEntry: id =>
    set(s => {
      const before = s.data.entries.find(e => e.id === id);
      if (!before || !before.deletedAt || isLocked(s.data, before.seasonId))
        return s;
      const { deletedAt: _d, deletedBy: _b, ...rest } = before;
      const after: JournalEntry = {
        ...rest,
        version: before.version + 1,
        updatedAt: Date.now(),
        updatedBy: getCurrentActor(),
      };
      remote({ kind: 'entry.upsert', entry: after });
      return {
        data: commitAudited(
          {
            ...s.data,
            entries: s.data.entries.map(e => (e.id === id ? after : e)),
          },
          {
            action: 'entry.restore',
            category: 'securite',
            target: 'entry',
            summary: `Restauration de l'écriture « ${before.label} ».`,
            targetId: id,
          }
        ),
      };
    }),

  // Les justificatifs vivent dans une table à part (Supabase Storage en mode
  // serveur) ; ces actions ne mettent à jour que l'état local + l'audit (pas
  // d'emit `entry.upsert` : la colonne attachments n'existe pas côté entries).
  addAttachment: (entryId, attachment) =>
    set(s => {
      const before = s.data.entries.find(e => e.id === entryId);
      if (!before || isLocked(s.data, before.seasonId)) return s;
      const after = {
        ...before,
        attachments: [...before.attachments, attachment],
        updatedAt: Date.now(),
      };
      return {
        data: commitAudited(
          {
            ...s.data,
            entries: s.data.entries.map(e => (e.id === entryId ? after : e)),
          },
          {
            action: 'entry.attach',
            category: 'metier',
            target: 'entry',
            summary: `Pièce jointe « ${attachment.name} » ajoutée à « ${before.label} ».`,
            targetId: entryId,
          }
        ),
      };
    }),

  removeAttachment: (entryId, attId) =>
    set(s => {
      const before = s.data.entries.find(e => e.id === entryId);
      if (!before || isLocked(s.data, before.seasonId)) return s;
      const att = before.attachments.find(a => a.id === attId);
      const after = {
        ...before,
        attachments: before.attachments.filter(a => a.id !== attId),
        updatedAt: Date.now(),
      };
      return {
        data: commitAudited(
          {
            ...s.data,
            entries: s.data.entries.map(e => (e.id === entryId ? after : e)),
          },
          {
            action: 'entry.detach',
            category: 'metier',
            target: 'entry',
            summary: `Pièce jointe${att ? ` « ${att.name} »` : ''} retirée de « ${before.label} ».`,
            targetId: entryId,
          }
        ),
      };
    }),
});
