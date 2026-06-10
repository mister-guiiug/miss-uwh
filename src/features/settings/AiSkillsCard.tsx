import { useState } from 'react';
import { Eye, EyeOff, Save, Sparkles, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.ts';
import { IS_SUPABASE } from '../../backend/config.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LABELS,
  type AiProvider,
} from '../../shared/types/domain.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { notifySuccess } from '../../shared/lib/toasts.ts';

/** Rôles autorisés à éditer la config commune (miroir de la RLS ai_config). */
const SHARED_EDITORS = [
  'admin_technique',
  'tresorier',
  'tresorier_adjoint',
  'entraineur',
  'president',
] as const;

const MODEL_PLACEHOLDER: Record<AiProvider, string> = {
  anthropic: 'claude-opus-4-8 (défaut)',
  openai: 'gpt-4o',
};

/**
 * Réglages → « Génération IA ». Deux niveaux :
 *  - LOCAL à l'appareil (clé API perso jamais synchronisée, modèle, endpoint,
 *    préférences de l'entraîneur) — la « partie variable par utilisateur » ;
 *  - COMMUN au club (skills partagés, synchronisés) — la « partie fixe pour
 *    tous », éditable par admin / entraîneur / président.
 */
export function AiSkillsCard() {
  const ai = useAppStore(s => s.data.settings.ai);
  const sharedSkills = useAppStore(s => s.data.aiConfig?.sharedSkills ?? '');
  const updateAiSettings = useAppStore(s => s.updateAiSettings);
  const updateAiClubConfig = useAppStore(s => s.updateAiClubConfig);
  const { roles } = useAuth();

  const provider: AiProvider = ai?.provider ?? 'anthropic';
  const [showKey, setShowKey] = useState(false);
  const [draftShared, setDraftShared] = useState(sharedSkills);

  // En mode local (sans auth), l'utilisateur unique édite la config commune.
  const canEditShared =
    !IS_SUPABASE || SHARED_EDITORS.some(r => roles.includes(r));
  const sharedDirty = draftShared !== sharedSkills;

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={16} className="text-primary" aria-hidden="true" />
        <h3 className="font-display font-bold">Génération IA</h3>
      </div>
      <p className="mb-3 text-xs text-[var(--uwh-text-soft)]">
        Génère des exercices d'entraînement par IA (onglet Entraînements →
        Exercices → « IA »). Votre clé est utilisée directement depuis cet
        appareil.
      </p>

      <div className="flex flex-col gap-3">
        <SelectField
          label="Fournisseur"
          value={provider}
          onChange={e =>
            updateAiSettings({ provider: e.target.value as AiProvider })
          }
        >
          {AI_PROVIDERS.map(p => (
            <option key={p} value={p}>
              {AI_PROVIDER_LABELS[p]}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" htmlFor="ai-key">
            Clé API (cet appareil)
          </label>
          <div className="flex gap-2">
            <input
              id="ai-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={ai?.apiKey ?? ''}
              onChange={e => updateAiSettings({ apiKey: e.target.value })}
              placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              className="min-h-11 w-full rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-4 text-[16px] focus:border-primary"
            />
            <Button
              variant="secondary"
              aria-label={showKey ? 'Masquer la clé' : 'Afficher la clé'}
              onClick={() => setShowKey(v => !v)}
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
          <p className="text-xs text-[var(--uwh-text-soft)]">
            ⚠️ Stockée uniquement sur cet appareil (non synchronisée, non
            partagée). Ne s'affiche jamais aux autres membres.
          </p>
        </div>

        <TextField
          label="Modèle"
          value={ai?.model ?? ''}
          onChange={e => updateAiSettings({ model: e.target.value })}
          placeholder={MODEL_PLACEHOLDER[provider]}
        />

        <TextField
          label={
            provider === 'openai'
              ? 'URL de l’API (endpoint)'
              : 'URL de l’API (optionnel)'
          }
          type="url"
          inputMode="url"
          value={ai?.baseUrl ?? ''}
          onChange={e => updateAiSettings({ baseUrl: e.target.value })}
          placeholder={
            provider === 'openai'
              ? 'https://api.openai.com/v1'
              : 'https://api.anthropic.com'
          }
          hint={
            provider === 'openai'
              ? 'OpenAI, OpenRouter, Mistral, Groq… (compatible /chat/completions).'
              : 'Laisser vide pour l’API Anthropic officielle.'
          }
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" htmlFor="ai-user-skills">
            Vos instructions (cet appareil)
          </label>
          <textarea
            id="ai-user-skills"
            value={ai?.userSkills ?? ''}
            onChange={e => updateAiSettings({ userSkills: e.target.value })}
            placeholder="Ex. Je privilégie les exercices ludiques pour les jeunes."
            className="min-h-20 w-full rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-4 py-2 text-[16px] focus:border-primary"
          />
          <p className="text-xs text-[var(--uwh-text-soft)]">
            Préférences personnelles (partie variable), ajoutées à vos
            générations uniquement.
          </p>
        </div>

        {/* Partie commune (synchronisée) */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] p-3">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-primary" aria-hidden="true" />
            <label className="text-sm font-semibold" htmlFor="ai-shared-skills">
              Contexte commun du club
            </label>
          </div>
          <textarea
            id="ai-shared-skills"
            value={draftShared}
            disabled={!canEditShared}
            onChange={e => setDraftShared(e.target.value)}
            placeholder="Ex. Club de niveau régional. Insister sur l'apnée sécurisée et le jeu collectif. Terminologie FFESSM."
            className="min-h-24 w-full rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] px-4 py-2 text-[16px] focus:border-primary disabled:opacity-60"
          />
          <p className="text-xs text-[var(--uwh-text-soft)]">
            {canEditShared
              ? 'Partagé avec tout le club (partie fixe). Injecté dans toutes les générations.'
              : 'Défini par un·e responsable (admin / entraîneur / président). Lecture seule.'}
          </p>
          {canEditShared && (
            <Button
              variant="secondary"
              className="self-start"
              disabled={!sharedDirty}
              onClick={() => {
                updateAiClubConfig(draftShared.trim());
                notifySuccess('Contexte commun du club enregistré.');
              }}
            >
              <Save size={16} aria-hidden="true" /> Enregistrer pour tous
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
