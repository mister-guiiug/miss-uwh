import type { Season } from '../../shared/types/domain.ts';
import { createUuid } from '../../shared/lib/id.ts';
import { computeBilan } from '../../shared/lib/engine.ts';
import { getCurrentClubId } from '../../backend/clubContext.ts';
import type { SeasonActions, StoreSlice } from '../types.ts';
import {
  commitAudited,
  commitPlain,
  getCurrentActor,
  remote,
  seasonOf,
} from '../storeHelpers.ts';

/** Saisons : création, clôture/verrouillage, réouverture, reliquats, budget. */
export const createSeasonSlice: StoreSlice<SeasonActions> = set => ({
  setActiveSeason: id =>
    set(s => ({ data: commitPlain({ ...s.data, activeSeasonId: id }) })),

  addSeason: (label, opening) => {
    const year = Number(label.slice(0, 4)) || new Date().getFullYear();
    const season: Season = {
      id: createUuid(),
      clubId: getCurrentClubId(),
      label,
      startDate: `${year}-09-01`,
      endDate: `${year + 1}-08-31`,
      status: 'ouverte',
      openingBalance: opening,
    };
    set(s => ({
      data: commitAudited(
        {
          ...s.data,
          seasons: [...s.data.seasons, season],
          activeSeasonId: season.id,
        },
        {
          action: 'season.create',
          category: 'metier',
          target: 'season',
          summary: `Création de la saison ${label}.`,
          targetId: season.id,
        }
      ),
    }));
    remote({ kind: 'season.upsert', season });
    return season.id;
  },

  closeSeason: id =>
    set(s => {
      const season = seasonOf(s.data, id);
      if (!season || season.status === 'cloturee') return s;
      const bilan = computeBilan(season, s.data.entries);
      const closed: Season = {
        ...season,
        status: 'cloturee',
        closingBalance: bilan.tresorerie,
        lockedAt: Date.now(),
        lockedBy: getCurrentActor(),
      };
      // Serveur : RPC qui recalcule le solde et vérifie le rôle (le local
      // calcule aussi pour l'affichage immédiat ; ils coïncident).
      remote({ kind: 'season.close', id });
      return {
        data: commitAudited(
          {
            ...s.data,
            seasons: s.data.seasons.map(x => (x.id === id ? closed : x)),
          },
          {
            action: 'season.close',
            category: 'securite',
            target: 'season',
            summary: `Clôture et verrouillage de la saison ${season.label} (solde ${bilan.tresorerie.toFixed(2)} €).`,
            targetId: id,
            after: { closingBalance: bilan.tresorerie },
          }
        ),
      };
    }),

  reopenSeason: (id, reason) =>
    set(s => {
      const season = seasonOf(s.data, id);
      if (!season || season.status !== 'cloturee') return s;
      const reopened: Season = {
        ...season,
        status: 'ouverte',
        reopenedAt: Date.now(),
        reopenReason: reason,
      };
      remote({ kind: 'season.reopen', id, reason });
      return {
        data: commitAudited(
          {
            ...s.data,
            seasons: s.data.seasons.map(x => (x.id === id ? reopened : x)),
          },
          {
            action: 'season.reopen',
            category: 'securite',
            target: 'season',
            summary: `Réouverture exceptionnelle de la saison ${season.label} — motif : ${reason}.`,
            targetId: id,
          }
        ),
      };
    }),

  setSeasonOpening: (id, opening) =>
    set(s => {
      const season = seasonOf(s.data, id);
      if (!season || season.status === 'cloturee') return s;
      const updated: Season = { ...season, openingBalance: opening };
      remote({ kind: 'season.upsert', season: updated });
      return {
        data: commitAudited(
          {
            ...s.data,
            seasons: s.data.seasons.map(x => (x.id === id ? updated : x)),
          },
          {
            action: 'season.opening',
            category: 'metier',
            target: 'season',
            summary: `Reliquat d'ouverture de ${season.label} fixé à ${opening.toFixed(2)} €.`,
            targetId: id,
          }
        ),
      };
    }),

  carryOverReliquat: (fromId, toId) =>
    set(s => {
      const from = seasonOf(s.data, fromId);
      const to = seasonOf(s.data, toId);
      if (!from || !to || to.status === 'cloturee') return s;
      const opening = from.closingBalance ?? from.openingBalance;
      const updated: Season = { ...to, openingBalance: opening };
      remote({ kind: 'season.upsert', season: updated });
      return {
        data: commitAudited(
          {
            ...s.data,
            seasons: s.data.seasons.map(x => (x.id === toId ? updated : x)),
          },
          {
            action: 'season.carryover',
            category: 'metier',
            target: 'season',
            summary: `Report du solde de clôture de ${from.label} comme reliquat d'ouverture de ${to.label} (${opening.toFixed(2)} €).`,
            targetId: toId,
          }
        ),
      };
    }),

  setBudget: (seasonId, code, amount) =>
    set(s => ({
      data: commitPlain({
        ...s.data,
        seasons: s.data.seasons.map(x =>
          x.id === seasonId
            ? { ...x, budget: { ...(x.budget ?? {}), [code]: amount } }
            : x
        ),
      }),
    })),
});
