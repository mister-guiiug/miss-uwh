/**
 * Fabrique de trios CRUD pour les collections d'entités uniformes (adhérents,
 * tuteurs, séances, exercices, stratégies, arbitres, événements de club,
 * annonces, tournois, albums).
 *
 * Comportement reproduit À L'IDENTIQUE de l'existant (verrouillé par
 * `storeCrud.test.ts`) :
 *  - `add` : génère un UUID, journalise un audit `*.create` (catégorie métier),
 *    émet l'upsert distant, renvoie l'id ;
 *  - `update` : remplace l'entité, émet l'upsert, **sans audit** (no-op si
 *    l'id est inconnu) ;
 *  - `remove` : retire l'entité (+ cascade éventuelle), émet le delete, **sans
 *    audit**.
 */
import type { StoreApi } from 'zustand';
import type { AppData } from '../shared/types/domain.ts';
import type { RemoteOp } from '../backend/syncBus.ts';
import type { AppState } from './types.ts';
import { createUuid } from '../shared/lib/id.ts';
import { commitAudited, commitPlain, remote } from './storeHelpers.ts';

type SetState = StoreApi<AppState>['setState'];

export interface CrudConfig<T extends { id: string }> {
  /** Lecture de la collection dans l'état. */
  get: (data: AppData) => T[];
  /** Remplacement immuable de la collection. */
  replace: (data: AppData, list: T[]) => AppData;
  /** Action d'audit posée à la création (ex. `adherent.create`). */
  auditAction: string;
  /** Type de cible d'audit (ex. `adherent`). */
  auditTarget: string;
  /** Résumé d'audit à la création. */
  summary: (entity: T) => string;
  upsertOp: (entity: T) => RemoteOp;
  deleteOp: (id: string) => RemoteOp;
  /** Mutations en cascade à la suppression (ex. tuteurs d'un adhérent). */
  cascadeDelete?: (data: AppData, id: string) => AppData;
}

export interface Crud<T extends { id: string }> {
  add: (input: Omit<T, 'id'>) => string;
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => void;
  remove: (id: string) => void;
}

export function makeCrud<T extends { id: string }>(
  set: SetState,
  config: CrudConfig<T>
): Crud<T> {
  return {
    add: input => {
      const entity = { ...input, id: createUuid() } as T;
      set(s => ({
        data: commitAudited(
          config.replace(s.data, [...config.get(s.data), entity]),
          {
            action: config.auditAction,
            category: 'metier',
            target: config.auditTarget,
            summary: config.summary(entity),
            targetId: entity.id,
          }
        ),
      }));
      remote(config.upsertOp(entity));
      return entity.id;
    },

    update: (id, patch) =>
      set(s => {
        const before = config.get(s.data).find(x => x.id === id);
        if (!before) return s;
        const after = { ...before, ...patch } as T;
        remote(config.upsertOp(after));
        return {
          data: commitPlain(
            config.replace(
              s.data,
              config.get(s.data).map(x => (x.id === id ? after : x))
            )
          ),
        };
      }),

    remove: id =>
      set(s => {
        remote(config.deleteOp(id));
        let data = config.replace(
          s.data,
          config.get(s.data).filter(x => x.id !== id)
        );
        if (config.cascadeDelete) data = config.cascadeDelete(data, id);
        return { data: commitPlain(data) };
      }),
  };
}
