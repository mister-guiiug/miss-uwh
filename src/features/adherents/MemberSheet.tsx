import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  ADHERENT_CATEGORIES,
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  MEMBER_STATUSES,
  type Adherent,
  type AdherentCategory,
  type MemberRole,
  type MemberStatus,
} from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';
import { useZodForm } from '../../shared/hooks/useZodForm.ts';
import {
  memberFormSchema,
  type MemberFormValues,
} from '../../shared/lib/formSchemas.ts';

const CAT_LABELS: Record<AdherentCategory, string> = {
  adulte: 'Adulte',
  adulte_reduit: 'Adulte réduit',
  jeune: 'Jeune',
  enfant: 'Enfant',
};
const STATUS_LABELS: Record<MemberStatus, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
};

interface Props {
  open: boolean;
  member: Adherent | null;
  onClose: () => void;
  /** Rôle pré-coché à la création (ex. depuis l'écran Encadrement). */
  defaultRole?: MemberRole;
}

export function MemberSheet({ open, member, onClose, defaultRole }: Props) {
  const season = useAppStore(selectActiveSeason);
  const addAdherent = useAppStore(s => s.addAdherent);
  const updateAdherent = useAppStore(s => s.updateAdherent);
  const deleteAdherent = useAppStore(s => s.deleteAdherent);

  const initial: MemberFormValues = {
    firstName: member?.firstName ?? '',
    lastName: member?.lastName ?? '',
    birthDate: member?.birthDate ?? '',
    category: member?.category ?? 'adulte',
    roles: member?.roles ?? (defaultRole ? [defaultRole] : []),
    licenceNumber: member?.licenceNumber ?? '',
    licenceExpiry: member?.licenceExpiry ?? '',
    medicalCertExpiry: member?.medicalCertExpiry ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    status: member?.status ?? 'actif',
    notes: member?.notes ?? '',
  };
  const { values, errors, setValue, submit } = useZodForm(
    memberFormSchema,
    initial
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleRole(r: MemberRole) {
    const next = values.roles.includes(r)
      ? values.roles.filter(x => x !== r)
      : [...values.roles, r];
    setValue('roles', next);
  }

  function save() {
    submit(parsed => {
      const input: Omit<Adherent, 'id'> = {
        seasonId: member?.seasonId ?? season.id,
        amount: member?.amount ?? 0,
        paid: member?.paid ?? false,
        ...parsed,
      };
      if (member) updateAdherent(member.id, input);
      else addAdherent(input);
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      title={member ? 'Modifier le membre' : 'Nouveau membre'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {member && (
            <Button
              variant="danger"
              aria-label="Supprimer"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save}>
            {member ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Prénom"
            value={values.firstName}
            error={errors.firstName}
            onChange={e => setValue('firstName', e.target.value)}
          />
          <TextField
            label="Nom"
            value={values.lastName}
            onChange={e => setValue('lastName', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Naissance"
            type="date"
            value={values.birthDate}
            onChange={e => setValue('birthDate', e.target.value)}
          />
          <SelectField
            label="Catégorie"
            value={values.category}
            onChange={e =>
              setValue('category', e.target.value as AdherentCategory)
            }
          >
            {ADHERENT_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {CAT_LABELS[c]}
              </option>
            ))}
          </SelectField>
        </div>

        <fieldset className="rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            Rôles dans le club
          </legend>
          <div className="flex flex-wrap gap-2">
            {MEMBER_ROLES.map(r => {
              const on = values.roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRole(r)}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
                    on
                      ? 'bg-primary text-white'
                      : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
                  }`}
                >
                  {MEMBER_ROLE_LABELS[r]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="N° licence"
            value={values.licenceNumber}
            onChange={e => setValue('licenceNumber', e.target.value)}
          />
          <SelectField
            label="Statut"
            value={values.status}
            onChange={e => setValue('status', e.target.value as MemberStatus)}
          >
            {MEMBER_STATUSES.map(s => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Licence — expire le"
            type="date"
            value={values.licenceExpiry}
            onChange={e => setValue('licenceExpiry', e.target.value)}
          />
          <TextField
            label="Certificat médical — expire le"
            type="date"
            value={values.medicalCertExpiry}
            onChange={e => setValue('medicalCertExpiry', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Email"
            type="email"
            value={values.email}
            error={errors.email}
            onChange={e => setValue('email', e.target.value)}
          />
          <TextField
            label="Téléphone"
            inputMode="tel"
            value={values.phone}
            onChange={e => setValue('phone', e.target.value)}
          />
        </div>
        <TextAreaField
          label="Notes (optionnel)"
          value={values.notes}
          onChange={e => setValue('notes', e.target.value)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce membre ?"
        danger
        confirmLabel="Supprimer"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (member) deleteAdherent(member.id);
          onClose();
        }}
      >
        Le membre est retiré du registre (et du serveur en mode Supabase).
      </ConfirmDialog>
    </Sheet>
  );
}
