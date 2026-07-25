import { useState } from 'react';
import { Repeat, Trash2, Zap } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { allCategories, categoryLabel } from '../../shared/lib/categories.ts';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../../shared/types/domain.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { useI18n, type TKey } from '../../i18n/index.ts';

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
  const { t } = useI18n();

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
      setFlash(t('io.recurring.generated', { label: r?.label ?? '', date }));
      setTimeout(() => setFlash(undefined), 2500);
    }
  }

  return (
    <Sheet open={open} title={t('io.recurring.title')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--uwh-text-soft)]">
          {t('io.recurring.intro')}
        </p>

        <TextField
          label={t('io.recurring.genDate')}
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
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('io.recurring.noTemplates')}
          </p>
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
                    {formatEuro(r.amount)} ·{' '}
                    {t(`enums.paymentMethod.${r.method}` as TKey)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  aria-label={t('io.recurring.generateAria', {
                    label: r.label,
                  })}
                  disabled={season.status === 'cloturee'}
                  onClick={() => onGenerate(r.id)}
                >
                  <Zap size={16} aria-hidden="true" />{' '}
                  {t('io.recurring.generate')}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t('io.recurring.deleteAria', { label: r.label })}
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
            <Repeat size={13} aria-hidden="true" />{' '}
            {t('io.recurring.newTemplate')}
          </legend>
          <TextField
            label={t('io.recurring.label')}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={t('io.recurring.labelPlaceholder')}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t('common.category')}
              value={categoryCode}
              onChange={e => setCategoryCode(e.target.value)}
            >
              {allCategories().map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t('io.recurring.amountEuro')}
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <SelectField
            label={t('io.recurring.method')}
            value={method}
            onChange={e => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>
                {t(`enums.paymentMethod.${m}` as TKey)}
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
            {t('io.recurring.addTemplate')}
          </Button>
        </fieldset>
      </div>
    </Sheet>
  );
}
