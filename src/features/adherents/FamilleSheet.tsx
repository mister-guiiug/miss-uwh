import { useState } from 'react';
import { Mail, Phone, Trash2, UserPlus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.ts';
import {
  GUARDIAN_RELATIONS,
  type Adherent,
  type GuardianRelation,
} from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { Badge } from '../../shared/components/badges.tsx';

interface Props {
  open: boolean;
  member: Adherent;
  onClose: () => void;
}

/** Gère les parents / tuteurs / contacts d'urgence d'un membre. */
export function FamilleSheet({ open, member, onClose }: Props) {
  const { t } = useI18n();
  const allGuardians = useAppStore(s => s.data.guardians);
  const addGuardian = useAppStore(s => s.addGuardian);
  const deleteGuardian = useAppStore(s => s.deleteGuardian);
  const guardians = allGuardians.filter(g => g.memberId === member.id);

  const [relation, setRelation] = useState<GuardianRelation>('mere');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  function add() {
    if (!name.trim()) return;
    addGuardian({
      memberId: member.id,
      relation,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    });
    setName('');
    setPhone('');
    setEmail('');
  }

  return (
    <Sheet
      open={open}
      title={t('adherents.familleSheet.title', {
        name: `${member.firstName} ${member.lastName}`,
      })}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {guardians.length === 0 ? (
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('adherents.familleSheet.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {guardians.map(g => (
              <li
                key={g.id}
                className="flex items-center gap-2 rounded-2xl border border-[var(--uwh-border)] p-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Badge tone="primary">
                      {t(`enums.guardianRelation.${g.relation}` as TKey)}
                    </Badge>
                    <span className="truncate">{g.name}</span>
                  </p>
                  {(g.phone || g.email) && (
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--uwh-text-soft)]">
                      {g.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} aria-hidden="true" />
                          {g.phone}
                        </span>
                      )}
                      {g.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} aria-hidden="true" />
                          {g.email}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t('adherents.familleSheet.deleteAria', {
                    name: g.name,
                  })}
                  className="shrink-0 text-[var(--uwh-debit)]"
                  onClick={() => deleteGuardian(g.id)}
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
            {t('adherents.familleSheet.addLegend')}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t('adherents.familleSheet.relationLabel')}
              value={relation}
              onChange={e => setRelation(e.target.value as GuardianRelation)}
            >
              {GUARDIAN_RELATIONS.map(r => (
                <option key={r} value={r}>
                  {t(`enums.guardianRelation.${r}` as TKey)}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t('common.name')}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('common.phone')}
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <TextField
              label={t('common.email')}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <Button block disabled={!name.trim()} onClick={add}>
            {t('common.add')}
          </Button>
        </fieldset>
      </div>
    </Sheet>
  );
}
