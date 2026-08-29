import { useState } from 'react';
import {
  ArrowRightLeft,
  CalendarPlus,
  Check,
  Lock,
  LockOpen,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.ts';
import { computeBilan } from '../../shared/lib/engine.ts';
import type { Season } from '../../shared/types/domain.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { TextField } from '@mister-guiiug/dev-wpa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { Badge, Money } from '../../shared/components/badges.tsx';
import { useI18n } from '../../i18n/index.ts';

export function SeasonsScreen() {
  const { t } = useI18n();
  const seasons = useAppStore(s => s.data.seasons);
  const entries = useAppStore(s => s.data.entries);
  const activeId = useAppStore(s => s.data.activeSeasonId);
  const setActiveSeason = useAppStore(s => s.setActiveSeason);
  const addSeason = useAppStore(s => s.addSeason);
  const closeSeason = useAppStore(s => s.closeSeason);
  const reopenSeason = useAppStore(s => s.reopenSeason);
  const carryOver = useAppStore(s => s.carryOverReliquat);

  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newOpening, setNewOpening] = useState('');
  const [closing, setClosing] = useState<Season | null>(null);
  const [reopening, setReopening] = useState<Season | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const ordered = [...seasons].sort((a, b) => (a.label < b.label ? 1 : -1));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">
          {t('finances.seasons.title')}
        </h2>
        <Button onClick={() => setCreating(true)}>
          <CalendarPlus size={18} aria-hidden="true" />{' '}
          {t('finances.seasons.new')}
        </Button>
      </div>

      {ordered.map(season => {
        const bilan = computeBilan(season, entries);
        const isActive = season.id === activeId;
        const closed = season.status === 'cloturee';
        return (
          <Card key={season.id} className={isActive ? 'border-primary/50' : ''}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-display text-base font-bold">
                  {season.label}
                  {closed ? (
                    <Badge tone="warn">
                      <Lock size={11} aria-hidden="true" />{' '}
                      {t('finances.seasons.closed')}
                    </Badge>
                  ) : (
                    <Badge tone="credit">{t('finances.seasons.open')}</Badge>
                  )}
                  {isActive && (
                    <Badge tone="primary">{t('finances.seasons.active')}</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[var(--uwh-text-soft)]">
                  {t('finances.seasons.carryOver', {
                    value: season.openingBalance.toLocaleString('fr-FR'),
                  })}{' '}
                  ·{' '}
                  {season.reopenReason &&
                    t('finances.seasons.reopenedReason', {
                      reason: season.reopenReason,
                    })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--uwh-text-soft)]">
                  {t('finances.seasons.balance')}
                </p>
                <Money value={bilan.soldeCrediteur} signed />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {!isActive && (
                <Button
                  variant="secondary"
                  onClick={() => setActiveSeason(season.id)}
                >
                  <Check size={16} aria-hidden="true" />{' '}
                  {t('finances.seasons.activate')}
                </Button>
              )}
              {!closed ? (
                <Button variant="secondary" onClick={() => setClosing(season)}>
                  <Lock size={16} aria-hidden="true" />{' '}
                  {t('finances.seasons.close')}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setReopening(season)}>
                  <LockOpen size={16} aria-hidden="true" />{' '}
                  {t('finances.seasons.reopen')}
                </Button>
              )}
            </div>

            {/* Report du solde de clôture vers une autre saison (règle 7) */}
            {closed && season.closingBalance != null && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ordered
                  .filter(t => t.id !== season.id && t.status !== 'cloturee')
                  .map(target => (
                    <button
                      key={target.id}
                      onClick={() => carryOver(season.id, target.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--uwh-surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--uwh-text-soft)]"
                    >
                      <ArrowRightLeft size={12} aria-hidden="true" />
                      {t('finances.seasons.carryTo', { target: target.label })}
                    </button>
                  ))}
              </div>
            )}
          </Card>
        );
      })}

      <Sheet
        open={creating}
        title={t('finances.seasons.newTitle')}
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-4">
          <TextField
            label={t('finances.seasons.label')}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={t('finances.seasons.labelPlaceholder')}
          />
          <TextField
            label={t('finances.seasons.opening')}
            inputMode="decimal"
            value={newOpening}
            onChange={e => setNewOpening(e.target.value)}
          />
          <Button
            block
            onClick={() => {
              if (!newLabel.trim()) return;
              addSeason(
                newLabel.trim(),
                Number(newOpening.replace(',', '.')) || 0
              );
              setNewLabel('');
              setNewOpening('');
              setCreating(false);
            }}
          >
            {t('finances.seasons.createActivate')}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!closing}
        title={t('finances.seasons.closeConfirmTitle', {
          label: closing?.label ?? '',
        })}
        confirmLabel={t('finances.seasons.closeConfirmLabel')}
        onCancel={() => setClosing(null)}
        onConfirm={() => {
          if (closing) closeSeason(closing.id);
          setClosing(null);
        }}
      >
        {t('finances.seasons.closeInfoBefore')}
        <strong>{t('finances.seasons.closeInfoStrong')}</strong>
        {t('finances.seasons.closeInfoAfter')}
      </ConfirmDialog>

      <Sheet
        open={!!reopening}
        title={t('finances.seasons.reopenTitle', {
          label: reopening?.label ?? '',
        })}
        onClose={() => setReopening(null)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('finances.seasons.reopenInfo')}
          </p>
          <TextField
            label={t('finances.seasons.reopenReasonLabel')}
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            placeholder={t('finances.seasons.reopenReasonPlaceholder')}
          />
          <Button
            block
            disabled={!reopenReason.trim()}
            onClick={() => {
              if (reopening) reopenSeason(reopening.id, reopenReason.trim());
              setReopenReason('');
              setReopening(null);
            }}
          >
            {t('finances.seasons.reopenButton')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
