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
import { Button } from '../../shared/components/Button.tsx';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';
import { Badge, Money } from '../../shared/components/badges.tsx';

export function SeasonsScreen() {
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
        <h2 className="font-display text-lg font-bold">Saisons</h2>
        <Button onClick={() => setCreating(true)}>
          <CalendarPlus size={18} aria-hidden="true" /> Nouvelle
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
                      <Lock size={11} aria-hidden="true" /> clôturée
                    </Badge>
                  ) : (
                    <Badge tone="credit">ouverte</Badge>
                  )}
                  {isActive && <Badge tone="primary">active</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-[var(--uwh-text-soft)]">
                  Reliquat {season.openingBalance.toLocaleString('fr-FR')} € ·{' '}
                  {season.reopenReason && `rouverte : ${season.reopenReason}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--uwh-text-soft)]">Solde</p>
                <Money value={bilan.soldeCrediteur} signed />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {!isActive && (
                <Button
                  variant="secondary"
                  onClick={() => setActiveSeason(season.id)}
                >
                  <Check size={16} aria-hidden="true" /> Activer
                </Button>
              )}
              {!closed ? (
                <Button variant="secondary" onClick={() => setClosing(season)}>
                  <Lock size={16} aria-hidden="true" /> Clôturer
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setReopening(season)}>
                  <LockOpen size={16} aria-hidden="true" /> Rouvrir
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
                      Reporter vers {target.label}
                    </button>
                  ))}
              </div>
            )}
          </Card>
        );
      })}

      <Sheet
        open={creating}
        title="Nouvelle saison"
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Libellé"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="2026-2027"
          />
          <TextField
            label="Reliquat d'ouverture (€)"
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
            Créer et activer
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!closing}
        title={`Clôturer la saison ${closing?.label} ?`}
        confirmLabel="Clôturer et verrouiller"
        onClose={() => setClosing(null)}
        onConfirm={() => closing && closeSeason(closing.id)}
      >
        Le journal sera <strong>verrouillé</strong> : plus aucune saisie,
        modification ou suppression. Le solde de clôture sera figé et la clôture
        tracée dans le journal d'audit. Une réouverture exceptionnelle reste
        possible (avec motif).
      </ConfirmDialog>

      <Sheet
        open={!!reopening}
        title={`Rouvrir la saison ${reopening?.label}`}
        onClose={() => setReopening(null)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--uwh-text-soft)]">
            La réouverture est exceptionnelle et tracée (audit sécurité).
            Indiquez un motif.
          </p>
          <TextField
            label="Motif de réouverture"
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            placeholder="Correction d'une écriture omise"
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
            Rouvrir la saison
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
