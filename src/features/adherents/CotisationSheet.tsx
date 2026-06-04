import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import type { Adherent } from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { TextField } from '../../shared/components/Field.tsx';

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
      title={`Cotisation — ${member.firstName} ${member.lastName}`}
      onClose={onClose}
      footer={
        <Button block onClick={save}>
          Enregistrer
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Montant (€)"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <label className="flex items-center justify-between gap-2 text-sm font-semibold">
          Cotisation réglée
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
