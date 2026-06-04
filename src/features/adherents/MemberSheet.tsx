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

  const [firstName, setFirstName] = useState(member?.firstName ?? '');
  const [lastName, setLastName] = useState(member?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(member?.birthDate ?? '');
  const [category, setCategory] = useState<AdherentCategory>(
    member?.category ?? 'adulte'
  );
  const [roles, setRoles] = useState<MemberRole[]>(
    member?.roles ?? (defaultRole ? [defaultRole] : [])
  );
  const [licenceNumber, setLicence] = useState(member?.licenceNumber ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? 'actif');
  const [notes, setNotes] = useState(member?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameMissing = !firstName.trim() && !lastName.trim();
  const nameError =
    submitted && nameMissing ? 'Indiquez au moins un nom.' : undefined;

  function toggleRole(r: MemberRole) {
    setRoles(rs => (rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]));
  }

  function save() {
    setSubmitted(true);
    if (nameMissing) return;
    const input: Omit<Adherent, 'id'> = {
      seasonId: member?.seasonId ?? season.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate || undefined,
      category,
      roles,
      licenceNumber: licenceNumber.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      status,
      amount: member?.amount ?? 0,
      paid: member?.paid ?? false,
      notes: notes.trim() || undefined,
    };
    if (member) updateAdherent(member.id, input);
    else addAdherent(input);
    onClose();
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
            value={firstName}
            error={nameError}
            onChange={e => setFirstName(e.target.value)}
          />
          <TextField
            label="Nom"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Naissance"
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
          />
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
        </div>

        <fieldset className="rounded-2xl border border-[var(--uwh-border)] p-3">
          <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
            Rôles dans le club
          </legend>
          <div className="flex flex-wrap gap-2">
            {MEMBER_ROLES.map(r => {
              const on = roles.includes(r);
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
            value={licenceNumber}
            onChange={e => setLicence(e.target.value)}
          />
          <SelectField
            label="Statut"
            value={status}
            onChange={e => setStatus(e.target.value as MemberStatus)}
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
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            label="Téléphone"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
        <TextAreaField
          label="Notes (optionnel)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
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
