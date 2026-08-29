import { useMemo, useState } from 'react';
import { Check, Coins, Download, FileText, Mail, X } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { formatEuro } from '../../shared/lib/format.ts';
import type { Adherent } from '../../shared/types/domain.ts';
import { useI18n } from '../../i18n/index.ts';
import { IS_SUPABASE } from '../../backend/config.ts';
import { importFromHelloAsso } from '../../backend/helloasso.ts';
import { printAttestations } from '../export/attestation.ts';
import { Badge } from '../../shared/components/badges.tsx';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { EmptyState } from '@mister-guiiug/dev-wpa-config/react/empty-state';
import { CotisationSheet } from './CotisationSheet.tsx';

/** Suivi des cotisations (montant dû/réglé) par membre sur la saison active. */
export function CotisationsScreen() {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.adherents);
  const club = useAppStore(s => s.data.club);
  const updateAdherent = useAppStore(s => s.updateAdherent);
  const helloAsso = useAppStore(s => s.data.settings.helloAsso);
  const [editing, setEditing] = useState<Adherent | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string>();

  async function runHelloAsso() {
    setImporting(true);
    setImportMsg(undefined);
    try {
      const r = await importFromHelloAsso(season.id, helloAsso);
      setImportMsg(
        t('adherents.cotisations.importResult', {
          imported: r.imported,
          updated: r.updated,
        }) +
          (r.skipped
            ? t('adherents.cotisations.importSkipped', { skipped: r.skipped })
            : '') +
          '.'
      );
    } catch (e) {
      setImportMsg(
        e instanceof Error ? e.message : t('adherents.cotisations.importFailed')
      );
    } finally {
      setImporting(false);
    }
  }

  const rows = useMemo(
    () =>
      all
        .filter(a => a.seasonId === season.id)
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
            'fr'
          )
        ),
    [all, season.id]
  );

  const summary = useMemo(() => {
    const total = rows.reduce((s, a) => s + (a.amount ?? 0), 0);
    const collected = rows
      .filter(a => a.paid)
      .reduce((s, a) => s + (a.amount ?? 0), 0);
    const paidCount = rows.filter(a => a.paid).length;
    return { total, collected, paidCount, unpaid: rows.length - paidCount };
  }, [rows]);

  // Emails des adhérents non à jour (pour une relance groupée en copie cachée).
  const unpaidEmails = useMemo(
    () =>
      rows.filter(a => !a.paid && a.email?.trim()).map(a => a.email!.trim()),
    [rows]
  );

  const paidMembers = useMemo(
    () =>
      rows
        .filter(a => a.paid)
        .map(a => ({
          name: `${a.firstName} ${a.lastName}`.trim(),
          amount: a.amount ?? 0,
        })),
    [rows]
  );

  function printRecus() {
    printAttestations({
      clubName: club.name,
      treasurer: club.treasurer,
      seasonLabel: season.label,
      dateLabel: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      members: paidMembers,
    });
  }

  function relancerImpayes() {
    if (unpaidEmails.length === 0) return;
    const subject = t('adherents.cotisations.reminderSubject', {
      club: club.name,
      season: season.label,
    });
    const body = t('adherents.cotisations.reminderBody', {
      season: season.label,
      signature: club.treasurer || club.name,
    });
    const href =
      `mailto:?bcc=${encodeURIComponent(unpaidEmails.join(','))}` +
      `&subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="rounded-2xl bg-[var(--uwh-surface-2)] p-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="credit">
            {t('adherents.cotisations.paidCount', { n: summary.paidCount })}
          </Badge>
          {summary.unpaid > 0 && (
            <Badge tone="warn">
              {t('adherents.cotisations.unpaidCount', { n: summary.unpaid })}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-[var(--uwh-text-soft)]">
          {t('adherents.cotisations.collected')}{' '}
          <strong>{formatEuro(summary.collected)}</strong> /{' '}
          {t('adherents.cotisations.expected')}{' '}
          <strong>{formatEuro(summary.total)}</strong>
        </p>
      </div>

      {summary.unpaid > 0 && (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            disabled={unpaidEmails.length === 0}
            onClick={relancerImpayes}
          >
            <Mail size={16} aria-hidden="true" />{' '}
            {t('adherents.cotisations.remindUnpaid', {
              n: unpaidEmails.length,
            })}
          </Button>
          {unpaidEmails.length < summary.unpaid && (
            <p className="text-xs text-[var(--uwh-text-soft)]">
              {t('adherents.cotisations.unpaidNoEmail', {
                n: summary.unpaid - unpaidEmails.length,
              })}
            </p>
          )}
        </div>
      )}

      {summary.paidCount > 0 && (
        <Button variant="secondary" onClick={printRecus}>
          <FileText size={16} aria-hidden="true" />{' '}
          {t('adherents.cotisations.receipts', { n: summary.paidCount })}
        </Button>
      )}

      {IS_SUPABASE && (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            disabled={importing}
            onClick={() => void runHelloAsso()}
          >
            <Download size={16} aria-hidden="true" />
            {importing
              ? t('adherents.cotisations.importing')
              : t('adherents.cotisations.importHelloAsso')}
          </Button>
          {(!helloAsso?.orgSlug || !helloAsso?.formSlug) && (
            <p className="text-xs text-[var(--uwh-text-soft)]">
              {t('adherents.cotisations.helloAssoHint')}
            </p>
          )}
          {importMsg && (
            <p className="text-xs text-[var(--uwh-text-soft)]">{importMsg}</p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Coins size={28} aria-hidden="true" />}
          title={t('adherents.cotisations.emptyTitle')}
          description={t('adherents.cotisations.emptyHint')}
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(a => (
            <li key={a.id} className="flex items-stretch gap-1.5">
              <button
                onClick={() => updateAdherent(a.id, { paid: !a.paid })}
                aria-label={
                  a.paid
                    ? t('adherents.cotisations.markUnpaid')
                    : t('adherents.cotisations.markPaid')
                }
                aria-pressed={a.paid}
                className="flex shrink-0 items-center justify-center rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] px-3"
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
              <button
                onClick={() => setEditing(a)}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {a.firstName} {a.lastName}
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">
                  {formatEuro(a.amount ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CotisationSheet
          open
          member={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
