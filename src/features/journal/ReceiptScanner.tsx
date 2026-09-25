import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Camera, FileUp, ScanText, TriangleAlert } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { useAppStore } from '../../store/useAppStore.ts';
import { AI_PROVIDER_LABELS } from '../../shared/types/domain.ts';
import { allCategories } from '../../shared/lib/categories.ts';
import { aiHost } from '../../shared/lib/aiClient.ts';
import { useI18n, type Translate } from '../../i18n/index.ts';
import {
  acceptNotice,
  describeReceiptError,
  hasAcceptedNotice,
  isPdfFile,
  type ReceiptDraft,
} from './receipt.ts';

interface Props {
  /** Pose la lecture dans le formulaire — que l'utilisateur validera. */
  onRead: (draft: ReceiptDraft) => void;
}

/** Ce que l'écran dit après une lecture : la confiance, et ce qui reste à faire. */
function resultMessage(draft: ReceiptDraft, t: Translate): string {
  const pct =
    draft.confidence === undefined
      ? undefined
      : Math.round(draft.confidence * 100);
  const main =
    pct === undefined
      ? t('finances.receipt.filledNoConfidence')
      : t(
          pct < 50
            ? 'finances.receipt.filledUncertain'
            : 'finances.receipt.filled',
          { confidence: pct }
        );
  if (draft.categoryCode || !draft.sens) return main;
  return `${main} ${t(
    draft.sens === 'debit'
      ? 'finances.receipt.pickCategoryDebit'
      : 'finances.receipt.pickCategoryCredit'
  )}`;
}

/**
 * « Lire le justificatif » : une photo (appareil photo) ou un fichier (image,
 * PDF) part chez le fournisseur d'IA configuré, et sa lecture PRÉ-REMPLIT le
 * formulaire. Rien n'est enregistré : c'est le bouton du formulaire qui le
 * fait, après relecture.
 *
 *  - Sans clé, le geste est grisé et un lien mène aux Réglages.
 *  - Au premier envoi vers un destinataire, une boîte dit où part le
 *    justificatif ; l'accord est retenu sur cet appareil, par destinataire.
 *  - Un PDF chez un fournisseur qui ne le lit pas est refusé AVANT l'accord
 *    et avant tout envoi.
 *  - Le module de lecture n'est chargé qu'au premier usage.
 */
export function ReceiptScanner({ onRead }: Props) {
  const { t } = useI18n();
  const ai = useAppStore(s => s.data.settings.ai);
  const hasKey = Boolean(ai?.apiKey?.trim());
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ReceiptDraft | null>(null);
  /** Le fichier choisi, en attente de l'accord d'envoi. */
  const [waiting, setWaiting] = useState<File | null>(null);

  async function read(file: File) {
    if (!ai) return;
    setBusy(true);
    setError(undefined);
    setResult(null);
    try {
      const { readReceipt } = await import('./receiptOcr.ts');
      // Le registre est relu au clic : il porte les catégories personnalisées.
      const draft = await readReceipt(file, ai, allCategories());
      onRead(draft);
      setResult(draft);
    } catch (e) {
      setError(describeReceiptError(e, t));
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Vidé tout de suite : choisir deux fois le même fichier relit encore.
    e.target.value = '';
    if (!file || !ai) return;
    setError(undefined);
    setResult(null);
    if (isPdfFile(file) && ai.provider !== 'anthropic') {
      setError(t('ai.errors.pdfUnsupported'));
      return;
    }
    if (!hasAcceptedNotice(ai)) {
      setWaiting(file);
      return;
    }
    void read(file);
  }

  const status = busy
    ? t('finances.receipt.reading')
    : result
      ? resultMessage(result, t)
      : '';

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-dashed border-[var(--uwh-border)] p-3"
    >
      <h3
        id={titleId}
        className="flex items-center gap-1.5 text-sm font-semibold"
      >
        <ScanText size={15} aria-hidden="true" /> {t('finances.receipt.title')}
      </h3>
      <p id={hintId} className="mt-1 text-xs text-[var(--uwh-text-soft)]">
        {hasKey ? t('finances.receipt.hint') : t('finances.receipt.noKey')}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasKey}
          loading={busy}
          aria-describedby={hintId}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={16} aria-hidden="true" />{' '}
          {t('finances.receipt.takePhoto')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasKey}
          loading={busy}
          aria-describedby={hintId}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp size={16} aria-hidden="true" />{' '}
          {t('finances.receipt.chooseFile')}
        </Button>
      </div>
      {!hasKey && (
        <Link
          to="/settings"
          className="mt-2 inline-block text-xs font-semibold text-primary underline"
        >
          {t('finances.receipt.configure')}
        </Link>
      )}
      {/* Les deux sélecteurs, pilotés par les boutons ci-dessus : l'un ouvre
          l'appareil photo (au dos, sur mobile), l'autre les fichiers. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-xs text-[var(--uwh-text-soft)] empty:hidden"
      >
        {status}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-xs text-[var(--uwh-debit)]"
        >
          <TriangleAlert
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}
      {ai && (
        <ConfirmDialog
          open={waiting !== null}
          title={t('finances.receipt.noticeTitle')}
          confirmLabel={t('finances.receipt.noticeConfirm')}
          onCancel={() => setWaiting(null)}
          onConfirm={() => {
            const file = waiting;
            acceptNotice(ai);
            setWaiting(null);
            if (file) void read(file);
          }}
        >
          {t('finances.receipt.noticeBody', {
            provider: AI_PROVIDER_LABELS[ai.provider],
            host: aiHost(ai),
          })}
        </ConfirmDialog>
      )}
    </section>
  );
}
