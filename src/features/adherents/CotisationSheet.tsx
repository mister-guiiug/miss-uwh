import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import type { Adherent } from '../../shared/types/domain.ts';
import { useI18n } from '../../i18n/index.ts';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';

/** Édite la cotisation (montant + réglée) d'un membre. */
export function CotisationSheet({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: Adherent;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const updateAdherent = useAppStore(s => s.updateAdherent);
  const [amount, setAmount] = useState(String(member.amount ?? 0));
  const [paid, setPaid] = useState(member.paid);

  function save() {
    updateAdherent(member.id, {
      amount: Number(amount.replace(',', '.')) || 0,
      paid,
    });
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={t('adherents.cotisationSheet.title', {
        name: `${member.firstName} ${member.lastName}`,
      })}
      onClose={onClose}
      footer={
        <Button block onClick={save}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('adherents.cotisationSheet.amountLabel')}
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <label className="flex items-center justify-between gap-2 text-sm font-semibold">
          {t('adherents.cotisationSheet.paidLabel')}
          <input
            type="checkbox"
            checked={paid}
            onChange={e => setPaid(e.target.checked)}
          />
        </label>
      </div>
    </Sheet>
  );
}
