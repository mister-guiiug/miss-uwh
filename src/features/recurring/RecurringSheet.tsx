import { useState } from 'react';
import { Repeat, Trash2, Zap } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { CATEGORIES, categoryLabel } from '../../shared/lib/categories.ts';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '../../shared/types/domain.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

function today(season: { startDate: string; endDate: string }): string {
  const d = new Date().toISOString().slice(0, 10);
  return d < season.startDate
    ? season.startDate
    : d > season.endDate
      ? season.endDate
      : d;
}

export function RecurringSheet({ open, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const recurrings = useAppStore(s => s.data.recurrings);
  const addRecurring = useAppStore(s => s.addRecurring);
  const deleteRecurring = useAppStore(s => s.deleteRecurring);
  const generate = useAppStore(s => s.generateFromRecurring);

  const [label, setLabel] = useState('');
  const [categoryCode, setCategoryCode] = useState('D12');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('prelevement');
  const [date, setDate] = useState(today(season));
  const [flash, setFlash] = useState<string>();

  function onGenerate(id: string) {
    const created = generate(id, date);
    if (created) {
      const r = recurrings.find(x => x.id === id);
      setFlash(`Écriture « ${r?.label} » générée au ${date}.`);
      setTimeout(() => setFlash(undefined), 2500);
    }
  }

  return (
    <Sheet open={open} title="Modèles récurrents" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--uwh-text-soft)]">
          Générez en un clic les écritures qui reviennent (frais bancaires,
          soutiens…). La saisie est ajoutée à la saison active.
        </p>

        <TextField
          label="Date de génération"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        {flash && (
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--uwh-credit)_12%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--uwh-credit)]">
            {flash}
          </p>
        )}

        {recurrings.length === 0 ? (
          <p className="text-sm text-[var(--uwh-text-soft)]">Aucun modèle.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recurrings.map(r => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-2xl border border-[var(--uwh-border)] p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-xs text-[var(--uwh-text-soft)]">
                    {r.categoryCode} {categoryLabel(r.categoryCode)} ·{' '}
                    {formatEuro(r.amount)} · {PAYMENT_METHOD_LABELS[r.method]}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  aria-label={`Générer ${r.label}`}
                  disabled={season.status === 'cloturee'}
                  onClick={() => onGenerate(r.id)}
                >
                  <Zap size={16} aria-hidden="true" /> Générer
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Supprimer ${r.label}`}
                  onClick={() => deleteRecurring(r.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            <Repeat size={13} aria-hidden="true" /> Nouveau modèle
          </legend>
          <TextField
            label="Libellé"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Frais bancaires SG"
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Catégorie"
              value={categoryCode}
              onChange={e => setCategoryCode(e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Montant (€)"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <SelectField
            label="Mode de règlement"
            value={method}
            onChange={e => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </SelectField>
          <Button
            block
            disabled={!label.trim() || !Number(amount.replace(',', '.'))}
            onClick={() => {
              addRecurring({
                label: label.trim(),
                categoryCode,
                amount: Number(amount.replace(',', '.')),
                method,
              });
              setLabel('');
              setAmount('');
            }}
          >
            Ajouter le modèle
          </Button>
        </fieldset>
      </div>
    </Sheet>
  );
}
