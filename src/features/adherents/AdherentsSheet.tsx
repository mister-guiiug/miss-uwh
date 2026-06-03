import { useMemo, useState } from 'react';
import { Check, Trash2, UserPlus, X } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  ADHERENT_CATEGORIES,
  type AdherentCategory,
} from '../../shared/types/domain.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { Badge } from '../../shared/components/badges.tsx';

const CAT_LABELS: Record<AdherentCategory, string> = {
  adulte: 'Adulte',
  adulte_reduit: 'Adulte réduit',
  jeune: 'Jeune',
  enfant: 'Enfant',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdherentsSheet({ open, onClose }: Props) {
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
    <Sheet open={open} title="Registre des adhérents" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Effectifs */}
        <div className="rounded-2xl bg-[var(--uwh-surface-2)] p-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="primary">{adherents.length} adhérent(s)</Badge>
            <Badge tone="credit">{summary.paid} à jour</Badge>
            {adherents.length - summary.paid > 0 && (
              <Badge tone="warn">
                {adherents.length - summary.paid} impayé(s)
              </Badge>
            )}
            {summary.byCat.map(x => (
              <Badge key={x.c} tone="neutral">
                {x.n} {CAT_LABELS[x.c].toLowerCase()}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[var(--uwh-text-soft)]">
            Total cotisations : <strong>{formatEuro(summary.total)}</strong>
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
                  aria-label={a.paid ? 'Marquer impayé' : 'Marquer payé'}
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
                    {CAT_LABELS[a.category]} · {formatEuro(a.amount)}
                    {a.licenceNumber ? ` · lic. ${a.licenceNumber}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => deleteAdherent(a.id)}
                  aria-label={`Supprimer ${a.firstName} ${a.lastName}`}
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
            <UserPlus size={13} aria-hidden="true" /> Nouvel adhérent
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Prénom"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
            <TextField
              label="Nom"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Catégorie"
              value={category}
              onChange={e => setCategory(e.target.value as AdherentCategory)}
            >
              {ADHERENT_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {CAT_LABELS[c]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Cotisation (€)"
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
            Ajouter l'adhérent
          </Button>
        </fieldset>
      </div>
    </Sheet>
  );
}
