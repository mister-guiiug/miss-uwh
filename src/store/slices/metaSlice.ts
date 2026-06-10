import type { AiClubConfig } from '../../shared/types/domain.ts';
import type { MetaActions, StoreSlice } from '../types.ts';
import { commitAudited, commitPlain, remote } from '../storeHelpers.ts';

/** Onboarding, identité du club, thème et réglages. */
export const createMetaSlice: StoreSlice<MetaActions> = set => ({
  completeOnboarding: () =>
    set(s => ({ data: commitPlain({ ...s.data, onboarded: true }) })),

  setupClub: (club, seasonLabel, opening) =>
    set(s => {
      const season = s.data.seasons.find(x => x.id === s.data.activeSeasonId);
      const seasons = season
        ? s.data.seasons.map(x =>
            x.id === season.id
              ? { ...x, label: seasonLabel, openingBalance: opening }
              : x
          )
        : s.data.seasons;
      return {
        data: commitPlain({ ...s.data, club, seasons, onboarded: true }),
      };
    }),

  setTheme: theme => {
    document.documentElement.dataset.theme = theme;
    set(s => ({
      data: commitPlain({
        ...s.data,
        settings: { ...s.data.settings, theme },
      }),
    }));
  },

  updateSettings: patch =>
    set(s => ({
      data: commitPlain({
        ...s.data,
        settings: { ...s.data.settings, ...patch },
      }),
    })),

  updateClub: patch =>
    set(s => ({
      data: commitAudited(
        { ...s.data, club: { ...s.data.club, ...patch } },
        {
          action: 'club.update',
          category: 'metier',
          target: 'club',
          summary: 'Mise à jour des informations du club.',
        }
      ),
    })),

  // Réglages IA LOCAUX (clé, modèle, skills variables) : jamais synchronisés
  // ni audités — préférence d'appareil, comme le thème.
  updateAiSettings: patch =>
    set(s => ({
      data: commitPlain({
        ...s.data,
        settings: {
          ...s.data.settings,
          ai: { provider: 'anthropic', ...s.data.settings.ai, ...patch },
        },
      }),
    })),

  // Skills COMMUNS du club (synchronisés) : audités + poussés vers le serveur
  // pour être partagés par tous (« partie fixe pour tous »).
  updateAiClubConfig: sharedSkills =>
    set(s => {
      const config: AiClubConfig = { sharedSkills, updatedAt: Date.now() };
      remote({ kind: 'aiconfig.upsert', config });
      return {
        data: commitAudited(
          { ...s.data, aiConfig: config },
          {
            action: 'aiconfig.update',
            category: 'metier',
            target: 'aiconfig',
            summary: 'Mise à jour des instructions IA communes du club.',
          }
        ),
      };
    }),
});
