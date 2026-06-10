import { useState } from 'react';
import { FileSpreadsheet, TriangleAlert } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { parseWorkbookFile, type WorkbookParseResult } from './excelImport.ts';
import { buildEntryInputs } from './buildImport.ts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportSheet({ open, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const importEntries = useAppStore(s => s.importEntries);
  const setSeasonOpening = useAppStore(s => s.setSeasonOpening);
  const [parsed, setParsed] = useState<WorkbookParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<number | null>(null);
  const [applyOpening, setApplyOpening] = useState(true);

  const seasonClosed = season.status === 'cloturee';

  // À la fermeture, on repart d'un état vierge : pas de résultat « fantôme »
  // d'un import précédent à la prochaine ouverture (la feuille fermée ne rend
  // rien, la remise à zéro est invisible).
  function close() {
    setParsed(null);
    setBusy(false);
    setError(undefined);
    setDone(null);
    setApplyOpening(true);
    onClose();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setDone(null);
    try {
      setParsed(await parseWorkbookFile(file));
    } catch (err) {
      console.error(err);
      setError(
        'Lecture impossible. Vérifiez votre connexion (le lecteur Excel est chargé à la demande) et le format .xlsx.'
      );
    } finally {
      setBusy(false);
      // Permet de re-sélectionner le MÊME fichier (sinon onChange ne refire pas).
      e.target.value = '';
    }
  }

  function doImport() {
    if (!parsed) return;
    if (applyOpening && parsed.openingBalance)
      setSeasonOpening(season.id, parsed.openingBalance);
    const n = importEntries(buildEntryInputs(parsed.entries, season.id));
    setDone(n);
  }

  // Action principale TOUJOURS visible (pied épinglé du Sheet) : sur mobile,
  // le bouton ne doit pas être perdu sous la ligne de flottaison.
  const footer =
    done !== null ? (
      <Button block onClick={close}>
        Terminer
      </Button>
    ) : parsed ? (
      <div className="flex flex-col gap-1.5">
        <Button block onClick={doImport} disabled={seasonClosed}>
          Importer {parsed.entries.length} écriture(s)
        </Button>
        {seasonClosed && (
          <p className="text-center text-xs text-[var(--uwh-warn)]">
            Saison {season.label} clôturée — rouvrez-la pour importer.
          </p>
        )}
      </div>
    ) : undefined;

  return (
    <Sheet
      open={open}
      title="Importer depuis Excel"
      onClose={close}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--uwh-text-soft)]">
          Importe la feuille <strong>« Compte »</strong> de votre classeur. Les
          écritures sont ajoutées à la saison active{' '}
          <strong>{season.label}</strong> (les catégories sont déduites du code
          d'ORDRE : R1…R9, D1…D13).
        </p>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] p-5 text-sm font-semibold text-primary">
          <FileSpreadsheet size={18} aria-hidden="true" className="shrink-0" />
          {busy ? 'Lecture…' : 'Choisir un fichier .xlsx'}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onFile}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-[var(--uwh-debit)]"
          >
            <TriangleAlert
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}

        {parsed && done === null && (
          <div className="flex flex-col gap-3 rounded-2xl bg-[var(--uwh-surface-2)] p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[var(--uwh-text-soft)]">Feuille lue</span>
              <span className="min-w-0 break-words text-right font-semibold">
                {parsed.sheet}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[var(--uwh-text-soft)]">
                Écritures détectées
              </span>
              <span className="font-semibold">{parsed.entries.length}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[var(--uwh-text-soft)]">
                Reliquat détecté
              </span>
              <span className="font-semibold tnum">
                {parsed.openingBalance.toLocaleString('fr-FR')} €
              </span>
            </div>
            {parsed.warnings.length > 0 && (
              <details className="text-xs text-[var(--uwh-warn)]">
                <summary className="cursor-pointer font-semibold">
                  {parsed.warnings.length} avertissement(s)
                </summary>
                <ul className="mt-1 list-disc pl-4">
                  {parsed.warnings.slice(0, 12).map((w, i) => (
                    <li key={i} className="break-words">
                      {w}
                    </li>
                  ))}
                  {parsed.warnings.length > 12 && (
                    <li>… et {parsed.warnings.length - 12} autre(s)</li>
                  )}
                </ul>
              </details>
            )}
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={applyOpening}
                onChange={e => setApplyOpening(e.target.checked)}
              />
              Appliquer le reliquat détecté comme solde d'ouverture
            </label>
          </div>
        )}

        {done !== null && (
          <div className="rounded-2xl bg-[color-mix(in_srgb,var(--uwh-credit)_12%,transparent)] p-4 text-sm">
            <p className="font-semibold text-[var(--uwh-credit)]">
              ✓ {done} écriture(s) importée(s) dans {season.label}.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
