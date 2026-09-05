import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { formatDateShort, formatSignedEuro } from '../../shared/lib/format.ts';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { useI18n } from '../../i18n/index.ts';
import {
  matchBankLines,
  parseBankCsv,
  type BankLine,
  type MatchResult,
} from './bankMatch.ts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReconcileSheet({ open, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const entries = useAppStore(s => s.data.entries);
  const setReconciled = useAppStore(s => s.setReconciled);
  const { t } = useI18n();
  const [bank, setBank] = useState<BankLine[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string>();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(undefined);
    setDone(0);
    try {
      const text = await file.text();
      const lines = parseBankCsv(text);
      const active = entries.filter(
        x => x.seasonId === season.id && !x.deletedAt
      );
      setBank(lines);
      setResult(matchBankLines(lines, active));
    } catch {
      setError(t('io.reconcile.readError'));
    }
    e.target.value = '';
  }

  function applyMatches() {
    if (!result) return;
    for (const m of result.matches) setReconciled(m.entryId, true);
    setDone(result.matches.length);
  }

  return (
    <Sheet open={open} title={t('io.reconcile.title')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--uwh-text-soft)]">
          {t('io.reconcile.introBefore')}
          <strong>{t('io.reconcile.introStrong')}</strong>
          {t('io.reconcile.introAfter')}
        </p>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] p-5 text-sm font-semibold text-primary">
          <FileSpreadsheet size={18} aria-hidden="true" />
          {t('io.reconcile.chooseFile')}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFile}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-[var(--uwh-debit)]">
            {error}
          </p>
        )}

        {result && done === 0 && (
          <div className="flex flex-col gap-3 rounded-2xl bg-[var(--uwh-surface-2)] p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--uwh-text-soft)]">
                {t('io.reconcile.statementLines')}
              </span>
              <span className="font-semibold">{bank.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--uwh-text-soft)]">
                {t('io.reconcile.matched')}
              </span>
              <span className="font-semibold text-[var(--uwh-credit)]">
                {result.matches.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--uwh-text-soft)]">
                {t('io.reconcile.unmatched')}
              </span>
              <span className="font-semibold">
                {result.unmatchedBank.length}
              </span>
            </div>
            {result.unmatchedBank.length > 0 && (
              <details className="text-xs text-[var(--uwh-text-soft)]">
                <summary className="cursor-pointer font-semibold">
                  {t('io.reconcile.seeUnmatched')}
                </summary>
                <ul className="mt-1 flex flex-col gap-1">
                  {result.unmatchedBank.slice(0, 20).map(i => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        {formatDateShort(bank[i]!.date)} · {bank[i]!.label}
                      </span>
                      <span className="tnum shrink-0">
                        {formatSignedEuro(bank[i]!.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Button
              block
              disabled={
                result.matches.length === 0 || season.status === 'cloturee'
              }
              onClick={applyMatches}
            >
              {t('io.reconcile.matchN', { n: result.matches.length })}
            </Button>
          </div>
        )}

        {done > 0 && (
          <div className="rounded-2xl bg-[color-mix(in_srgb,var(--uwh-credit)_12%,transparent)] p-4 text-sm">
            <p className="font-semibold text-[var(--uwh-credit)]">
              ✓ {t('io.reconcile.done', { n: done })}
            </p>
            <Button block className="mt-3" onClick={onClose}>
              {t('common.finish')}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
