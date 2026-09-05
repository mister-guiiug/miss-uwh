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
import { Card } from '@mister-guiiug/dev-pwa-config/react/card';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import {
  SelectField,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react/field';
import { notifySuccess } from '../../shared/lib/toasts.ts';
import { useI18n } from '../../i18n/index.ts';

/** Rôles autorisés à éditer la config commune (miroir de la RLS ai_config). */
const SHARED_EDITORS = [
  'admin_technique',
  'tresorier',
  'tresorier_adjoint',
  'entraineur',
  'president',
] as const;

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
  const { t } = useI18n();

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
        <h3 className="font-display font-bold">{t('ai.title')}</h3>
      </div>
      <p className="mb-3 text-xs text-[var(--uwh-text-soft)]">{t('ai.desc')}</p>

      <div className="flex flex-col gap-3">
        <SelectField
          label={t('ai.provider')}
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
            {t('ai.apiKey')}
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
              aria-label={showKey ? t('ai.hideKey') : t('ai.showKey')}
              onClick={() => setShowKey(v => !v)}
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
          <p className="text-xs text-[var(--uwh-text-soft)]">
            {t('ai.keyNote')}
          </p>
        </div>

        <TextField
          label={t('ai.model')}
          value={ai?.model ?? ''}
          onChange={e => updateAiSettings({ model: e.target.value })}
          placeholder={
            provider === 'anthropic'
              ? t('ai.modelPlaceholderAnthropic')
              : 'gpt-4o'
          }
        />

        <TextField
          label={
            provider === 'openai'
              ? t('ai.apiUrlEndpoint')
              : t('ai.apiUrlOptional')
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
            provider === 'openai' ? t('ai.hintOpenai') : t('ai.hintAnthropic')
          }
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" htmlFor="ai-user-skills">
            {t('ai.userSkills')}
          </label>
          <textarea
            id="ai-user-skills"
            value={ai?.userSkills ?? ''}
            onChange={e => updateAiSettings({ userSkills: e.target.value })}
            placeholder={t('ai.userSkillsPlaceholder')}
            className="min-h-20 w-full rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-4 py-2 text-[16px] focus:border-primary"
          />
          <p className="text-xs text-[var(--uwh-text-soft)]">
            {t('ai.userSkillsNote')}
          </p>
        </div>

        {/* Partie commune (synchronisée) */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] p-3">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-primary" aria-hidden="true" />
            <label className="text-sm font-semibold" htmlFor="ai-shared-skills">
              {t('ai.sharedTitle')}
            </label>
          </div>
          <textarea
            id="ai-shared-skills"
            value={draftShared}
            disabled={!canEditShared}
            onChange={e => setDraftShared(e.target.value)}
            placeholder={t('ai.sharedPlaceholder')}
            className="min-h-24 w-full rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] px-4 py-2 text-[16px] focus:border-primary disabled:opacity-60"
          />
          <p className="text-xs text-[var(--uwh-text-soft)]">
            {canEditShared ? t('ai.sharedEditable') : t('ai.sharedReadonly')}
          </p>
          {canEditShared && (
            <Button
              variant="secondary"
              className="self-start"
              disabled={!sharedDirty}
              onClick={() => {
                updateAiClubConfig(draftShared.trim());
                notifySuccess(t('ai.savedToast'));
              }}
            >
              <Save size={16} aria-hidden="true" /> {t('ai.saveForAll')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
