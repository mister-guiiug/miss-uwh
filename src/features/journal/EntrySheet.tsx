import { useMemo, useState } from 'react';
import { Eye, Paperclip, Trash2 } from 'lucide-react';
import {
  useAppStore,
  selectActiveSeason,
  type EntryInput,
} from '../../store/useAppStore.ts';
import {
  CATEGORIES,
  categoryByCode,
  COMPONENT_LABELS,
} from '../../shared/lib/categories.ts';
import {
  PAYMENT_METHODS,
  type Attachment,
  type JournalEntry,
  type PaymentMethod,
} from '../../shared/types/domain.ts';
import { useI18n, type TKey } from '../../i18n/index.ts';
import { IS_SUPABASE } from '../../backend/config.ts';
import {
  removeAttachmentRemote,
  signedUrl,
  uploadAttachment,
} from '../../backend/attachments.ts';
import { createUuid } from '../../shared/lib/id.ts';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import {
  SelectField,
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react/field';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { Badge } from '../../shared/components/badges.tsx';
import { validateEntry, hasErrors } from './entryValidation.ts';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';

const log = createLogger('journal');

interface Props {
  open: boolean;
  entry: JournalEntry | null;
  onClose: () => void;
}

export function EntrySheet({ open, entry, onClose }: Props) {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  // Catégories perso incluses ; le `custom` en dépendance force le recalcul
  // lorsqu'on en ajoute/retire une (allCategories() lit un registre mutable).
  const custom = useAppStore(s => s.data.customCategories);
  const cats = useMemo(() => [...CATEGORIES, ...custom], [custom]);
  const RECETTES = cats.filter(c => c.sens === 'recette');
  const DEPENSES = cats.filter(c => c.sens === 'depense');
  // Sélecteur stable + filtrage dans le corps (cf. note EventsSheet).
  const allEvents = useAppStore(s => s.data.events);
  const events = allEvents.filter(e => e.seasonId === season.id);
  const addEntry = useAppStore(s => s.addEntry);
  const updateEntry = useAppStore(s => s.updateEntry);
  const softDeleteEntry = useAppStore(s => s.softDeleteEntry);
  const addAttachment = useAppStore(s => s.addAttachment);
  const removeAttachment = useAppStore(s => s.removeAttachment);
  // Écriture VIVE du store (le prop `entry` est un instantané) : la liste des
  // pièces se rafraîchit après ajout/suppression. Sélecteur stable (renvoie la
  // référence existante).
  const liveEntry = useAppStore(s =>
    entry ? s.data.entries.find(e => e.id === entry.id) : undefined
  );
  const attachments = liveEntry?.attachments ?? entry?.attachments ?? [];

  const [date, setDate] = useState(entry?.date ?? season.startDate);
  const [categoryCode, setCategoryCode] = useState(entry?.categoryCode ?? 'R1');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [method, setMethod] = useState<PaymentMethod>(
    entry?.method ?? 'virement'
  );
  const [pieceRef, setPieceRef] = useState(entry?.pieceRef ?? '');
  const [invoiceCode, setInvoiceCode] = useState(entry?.invoiceCode ?? '');
  const [eventId, setEventId] = useState(entry?.eventId ?? '');
  const [observation, setObservation] = useState(entry?.observation ?? '');
  const [components, setComponents] = useState<Record<string, string>>(() => {
    const c = entry?.components ?? {};
    return Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, String(v)])
    );
  });
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [attBusy, setAttBusy] = useState(false);
  const [attError, setAttError] = useState<string>();

  const cat = categoryByCode(categoryCode);
  const sens = cat?.sens === 'depense' ? 'debit' : 'credit';
  const amountNum = Number(amount.replace(',', '.'));

  const parsedComponents = useMemo(() => {
    const entries = Object.entries(components)
      .map(([k, v]) => [k, Number(v.replace(',', '.'))] as const)
      .filter(([, v]) => Number.isFinite(v) && v !== 0);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }, [components]);

  const errors = validateEntry(
    {
      date,
      label,
      categoryCode,
      sens,
      amount: amountNum,
      method,
      components: parsedComponents,
    },
    season
  );

  function save() {
    setSubmitted(true);
    if (hasErrors(errors)) return;
    const input: EntryInput = {
      seasonId: season.id,
      categoryCode,
      date,
      label: label.trim(),
      sens,
      amount: amountNum,
      method,
      pieceRef: pieceRef.trim() || undefined,
      invoiceCode: invoiceCode.trim() || undefined,
      observation: observation.trim() || undefined,
      eventId: eventId || undefined,
      components: parsedComponents,
    };
    if (entry) updateEntry(entry.id, input);
    else addEntry(input);
    onClose();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !entry) return;
    setAttBusy(true);
    setAttError(undefined);
    try {
      if (IS_SUPABASE) {
        // Téléversement dans le bucket privé + métadonnées (RLS serveur).
        const att = await uploadAttachment(entry.id, file);
        addAttachment(entry.id, att);
      } else {
        // Mode local : inline en data URL.
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        addAttachment(entry.id, {
          id: createUuid(),
          name: file.name,
          mime: file.type,
          size: file.size,
          dataUrl,
          uploadedAt: Date.now(),
        });
      }
    } catch (err) {
      log.error('Envoi de la pièce jointe impossible', { error: err });
      setAttError(t('finances.entry.uploadFailed'));
    } finally {
      setAttBusy(false);
      e.target.value = '';
    }
  }

  async function openAttachment(att: Attachment) {
    setAttError(undefined);
    try {
      const url =
        att.dataUrl ??
        (att.storagePath ? await signedUrl(att.storagePath) : '');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setAttError(t('finances.entry.openFailed'));
    }
  }

  async function deleteAttachment(att: Attachment) {
    if (!entry) return;
    setAttError(undefined);
    try {
      if (IS_SUPABASE && att.storagePath) await removeAttachmentRemote(att);
      removeAttachment(entry.id, att.id);
    } catch {
      setAttError(t('finances.entry.deleteFailed'));
    }
  }

  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  return (
    <Sheet
      open={open}
      title={
        entry ? t('finances.entry.editTitle') : t('finances.entry.newTitle')
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {entry && (
            <Button
              variant="danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </Button>
          )}
          <Button block onClick={save} disabled={season.status === 'cloturee'}>
            {entry ? t('common.save') : t('common.add')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label={t('common.category')}
          value={categoryCode}
          error={err('categoryCode')}
          onChange={e => setCategoryCode(e.target.value)}
        >
          <optgroup label={t('finances.entry.income')}>
            {RECETTES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('finances.entry.expenses')}>
            {DEPENSES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </optgroup>
        </SelectField>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--uwh-text-soft)]">
            {t('finances.entry.sensLabel')}
          </span>
          <Badge tone={sens === 'credit' ? 'credit' : 'debit'}>
            {sens === 'credit'
              ? t('finances.entry.creditSens')
              : t('finances.entry.debitSens')}
          </Badge>
          {cat && cat.kind !== 'exploitation' && (
            <Badge tone="warn">
              {t(`enums.categoryKind.${cat.kind}` as TKey)}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('common.date')}
            type="date"
            value={date}
            error={err('date')}
            onChange={e => setDate(e.target.value)}
          />
          <TextField
            label={t('finances.entry.amount')}
            inputMode="decimal"
            value={amount}
            error={err('amount')}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        <TextField
          label={t('finances.entry.label')}
          value={label}
          error={err('label')}
          onChange={e => setLabel(e.target.value)}
          placeholder={t('finances.entry.labelPlaceholder')}
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label={t('finances.entry.method')}
            value={method}
            onChange={e => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>
                {t(`enums.paymentMethod.${m}` as TKey)}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t('finances.entry.pieceRef')}
            value={pieceRef}
            onChange={e => setPieceRef(e.target.value)}
            placeholder={t('finances.entry.pieceRefPlaceholder')}
          />
        </div>

        <TextField
          label={t('finances.entry.invoiceCode')}
          value={invoiceCode}
          onChange={e => setInvoiceCode(e.target.value)}
          placeholder={t('finances.entry.invoiceCodePlaceholder')}
        />

        {cat?.eventCapable && events.length > 0 && (
          <SelectField
            label={t('finances.entry.event')}
            value={eventId}
            onChange={e => setEventId(e.target.value)}
          >
            <option value="">{t('finances.entry.eventNone')}</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </SelectField>
        )}

        {cat?.components && (
          <fieldset className="rounded-2xl border border-[var(--uwh-border)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--uwh-text-soft)]">
              {t('finances.entry.components')}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {cat.components.map(key => (
                <label key={key} className="flex flex-col gap-1 text-xs">
                  <span className="text-[var(--uwh-text-soft)]">
                    {COMPONENT_LABELS[key] ?? key}
                  </span>
                  <input
                    inputMode="decimal"
                    className="min-h-10 rounded-xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-2 text-sm"
                    value={components[key] ?? ''}
                    onChange={e =>
                      setComponents(c => ({ ...c, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            {err('components') && (
              <p role="alert" className="mt-2 text-xs text-[var(--uwh-debit)]">
                {errors.components}
              </p>
            )}
          </fieldset>
        )}

        <TextAreaField
          label={t('finances.entry.observation')}
          value={observation}
          onChange={e => setObservation(e.target.value)}
        />

        {entry && (
          <div className="rounded-2xl border border-[var(--uwh-border)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Paperclip size={15} aria-hidden="true" />{' '}
                {t('finances.entry.attachments')}
              </span>
              <label className="cursor-pointer text-xs font-semibold text-primary">
                {attBusy ? t('finances.entry.uploading') : t('common.add')}
                <input
                  type="file"
                  className="hidden"
                  disabled={attBusy}
                  onChange={onFile}
                />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-[var(--uwh-text-soft)]">
                {t('finances.entry.noAttachments')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {attachments.map(a => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg bg-[var(--uwh-surface-2)] px-2 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {a.name}{' '}
                      <span className="text-[var(--uwh-text-soft)]">
                        {t('finances.entry.fileSize', {
                          size: Math.max(1, Math.round(a.size / 1024)),
                        })}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={t('finances.entry.viewFile', {
                        name: a.name,
                      })}
                      className="text-primary"
                      onClick={() => void openAttachment(a)}
                    >
                      <Eye size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('finances.entry.deleteFile', {
                        name: a.name,
                      })}
                      className="text-[var(--uwh-debit)]"
                      onClick={() => void deleteAttachment(a)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attError && (
              <p role="alert" className="mt-2 text-xs text-[var(--uwh-debit)]">
                {attError}
              </p>
            )}
          </div>
        )}

        {err('season') && (
          <p role="alert" className="text-sm text-[var(--uwh-debit)]">
            {errors.season}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('finances.entry.confirmDeleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (entry) softDeleteEntry(entry.id, 'Suppression manuelle');
          onClose();
          setConfirmDelete(false);
        }}
      >
        {t('finances.entry.deleteInfoBefore')}
        <strong>{t('finances.entry.deleteInfoStrong')}</strong>
        {t('finances.entry.deleteInfoAfter')}
      </ConfirmDialog>
    </Sheet>
  );
}
