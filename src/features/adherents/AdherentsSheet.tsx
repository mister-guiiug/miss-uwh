import { useMemo, useState } from 'react';
import { Check, Trash2, UserPlus, X } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  ADHERENT_CATEGORIES,
  type AdherentCategory,
} from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import {
  SelectField,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react/field';
import { Badge } from '../../shared/components/badges.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdherentsSheet({ open, onClose }: Props) {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.adherents);
  const addAdherent = useAppStore(s => s.addAdherent);
  const updateAdherent = useAppStore(s => s.updateAdherent);
  const deleteAdherent = useAppStore(s => s.deleteAdherent);
  const adherents = all.filter(a => a.seasonId === season.id);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [category, setCategory] = useState<AdherentCategory>('adulte');
  const [amount, setAmount] = useState('');

  const summary = useMemo(() => {
    const total = adherents.reduce((s, a) => s + a.amount, 0);
    const paid = adherents.filter(a => a.paid).length;
    const byCat = ADHERENT_CATEGORIES.map(c => ({
      c,
      n: adherents.filter(a => a.category === c).length,
    })).filter(x => x.n > 0);
    return { total, paid, byCat };
  }, [adherents]);

  return (
    <Sheet
      open={open}
      title={t('adherents.adherentsSheet.title')}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* Effectifs */}
        <div className="rounded-2xl bg-[var(--uwh-surface-2)] p-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="primary">
              {t('adherents.adherentsSheet.memberCount', {
                n: adherents.length,
              })}
            </Badge>
            <Badge tone="credit">
              {t('adherents.adherentsSheet.paidCount', { n: summary.paid })}
            </Badge>
            {adherents.length - summary.paid > 0 && (
              <Badge tone="warn">
                {t('adherents.adherentsSheet.unpaidCount', {
                  n: adherents.length - summary.paid,
                })}
              </Badge>
            )}
            {summary.byCat.map(x => (
              <Badge key={x.c} tone="neutral">
                {x.n} {t(`enums.adherentCategory.${x.c}` as TKey).toLowerCase()}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[var(--uwh-text-soft)]">
            {t('adherents.adherentsSheet.totalDues')}{' '}
            <strong>{formatEuro(summary.total)}</strong>
          </p>
        </div>

        {adherents.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {adherents.map(a => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-2xl border border-[var(--uwh-border)] p-2 text-sm"
              >
                <button
                  onClick={() => updateAdherent(a.id, { paid: !a.paid })}
                  aria-label={
                    a.paid
                      ? t('adherents.adherentsSheet.markUnpaid')
                      : t('adherents.adherentsSheet.markPaid')
                  }
                  aria-pressed={a.paid}
                  className="shrink-0"
                >
                  {a.paid ? (
                    <Check
                      size={18}
                      className="text-[var(--uwh-credit)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      size={18}
                      className="text-[var(--uwh-warn)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="truncate text-xs text-[var(--uwh-text-soft)]">
                    {t(`enums.adherentCategory.${a.category}` as TKey)} ·{' '}
                    {formatEuro(a.amount)}
                    {a.licenceNumber
                      ? t('adherents.adherentsSheet.licenceInfo', {
                          n: a.licenceNumber,
                        })
                      : ''}
                  </p>
                </div>
                <button
                  onClick={() => deleteAdherent(a.id)}
                  aria-label={t('adherents.adherentsSheet.deleteAria', {
                    name: `${a.firstName} ${a.lastName}`,
                  })}
                  className="shrink-0 text-[var(--uwh-debit)]"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            <UserPlus size={13} aria-hidden="true" />{' '}
            {t('adherents.adherentsSheet.newLegend')}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('common.firstName')}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
            <TextField
              label={t('common.lastName')}
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t('common.category')}
              value={category}
              onChange={e => setCategory(e.target.value as AdherentCategory)}
            >
              {ADHERENT_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {t(`enums.adherentCategory.${c}` as TKey)}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t('adherents.adherentsSheet.duesLabel')}
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <Button
            block
            disabled={!firstName.trim() && !lastName.trim()}
            onClick={() => {
              addAdherent({
                seasonId: season.id,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                category,
                amount: Number(amount.replace(',', '.')) || 0,
                paid: false,
              });
              setFirstName('');
              setLastName('');
              setAmount('');
            }}
          >
            {t('adherents.adherentsSheet.addButton')}
          </Button>
        </fieldset>
      </div>
    </Sheet>
  );
}
