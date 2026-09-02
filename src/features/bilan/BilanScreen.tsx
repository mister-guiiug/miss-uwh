import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Lock,
  Printer,
  Scale,
  Settings2,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { useBilan } from '../../shared/hooks/useBilan.ts';
import { Card } from '@mister-guiiug/dev-wpa-config/react/card';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { Badge, Money } from '../../shared/components/badges.tsx';
import { EventsSheet } from '../events/EventsSheet.tsx';
import type { BilanLine } from '../../shared/lib/engine.ts';
import { useI18n } from '../../i18n/index.ts';
import { getDefaultLocale } from '@mister-guiiug/dev-wpa-config/format';

function Kpi({
  label,
  value,
  Icon,
  signed = false,
  accent,
}: {
  label: string;
  value: number;
  Icon: typeof Wallet;
  signed?: boolean;
  accent?: boolean;
}) {
  return (
    <Card
      className={
        accent ? 'border-primary/40 bg-[var(--color-primary-soft)]/40' : ''
      }
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--uwh-text-soft)]">
        <Icon size={15} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-xl">
        <Money value={value} signed={signed} />
      </p>
    </Card>
  );
}

function LinesTable({
  lines,
  hideCompensated,
}: {
  lines: BilanLine[];
  hideCompensated: boolean;
}) {
  const { t } = useI18n();
  const shown = lines.filter(
    l =>
      (l.count > 0 || l.total !== 0) &&
      (!hideCompensated || l.kind !== 'compensee')
  );
  if (shown.length === 0)
    return (
      <p className="px-1 py-3 text-sm text-[var(--uwh-text-soft)]">
        {t('finances.bilan.noEntries')}
      </p>
    );
  return (
    <ul className="divide-y divide-[var(--uwh-border)]">
      {shown.map(l => (
        <li
          key={l.code}
          className="flex items-center justify-between gap-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              <span className="mr-1.5 text-[var(--uwh-text-soft)]">
                {l.code}
              </span>
              {l.label}
            </p>
            <div className="mt-0.5 flex gap-1.5">
              <span className="text-xs text-[var(--uwh-text-soft)]">
                {t('finances.bilan.entryCount', { n: l.count })}
              </span>
              {l.kind === 'compensee' && (
                <Badge tone="warn">{t('finances.bilan.compensated')}</Badge>
              )}
              {l.kind === 'regularisation' && (
                <Badge tone="neutral">{t('finances.bilan.adjustment')}</Badge>
              )}
            </div>
          </div>
          <Money value={l.total} className="shrink-0" />
        </li>
      ))}
    </ul>
  );
}

export function BilanScreen() {
  const { t } = useI18n();
  const season = useAppStore(selectActiveSeason);
  const club = useAppStore(s => s.data.club);
  const showCompensated = useAppStore(s => s.data.settings.showCompensated);
  const { bilan, events } = useBilan();
  const hideCompensated = !showCompensated;
  const [manageEvents, setManageEvents] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">{club.name}</h2>
          <p className="flex items-center gap-1.5 text-sm text-[var(--uwh-text-soft)]">
            {t('finances.bilan.season', { season: season.label })}
            {season.status === 'cloturee' && (
              <Badge tone="warn">
                <Lock size={11} aria-hidden="true" />{' '}
                {t('finances.bilan.closed')}
              </Badge>
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          aria-label={t('finances.bilan.printAria')}
        >
          <Printer size={18} aria-hidden="true" />
          PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label={t('finances.bilan.totalIncome')}
          value={bilan.totalRecettes}
          Icon={ArrowUpRight}
        />
        <Kpi
          label={t('finances.bilan.totalExpenses')}
          value={bilan.totalDepenses}
          Icon={ArrowDownRight}
        />
        <Kpi
          label={t('finances.bilan.creditBalance')}
          value={bilan.soldeCrediteur}
          Icon={Scale}
          signed
          accent
        />
        <Kpi
          label={t('finances.bilan.operatingResult')}
          value={bilan.resultatExploitation}
          Icon={TrendingUp}
          signed
        />
      </div>

      <Card className="print-block">
        <div className="mb-1 flex items-center gap-2">
          <Wallet size={16} className="text-primary" aria-hidden="true" />
          <h3 className="font-display font-bold">
            {t('finances.bilan.treasury')}
          </h3>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--uwh-text-soft)]">
            {t('finances.bilan.openingBalance', {
              value: bilan.reliquat.toLocaleString(getDefaultLocale()),
            })}
          </span>
          <Money value={bilan.tresorerie} />
        </div>
      </Card>

      <Card className="print-block">
        <div className="mb-2 flex items-center gap-2 text-[var(--uwh-credit)]">
          <ArrowUpRight size={16} aria-hidden="true" />
          <h3 className="font-display font-bold">
            {t('finances.bilan.income')}
          </h3>
        </div>
        <LinesTable lines={bilan.recettes} hideCompensated={hideCompensated} />
        <div className="mt-2 flex items-center justify-between border-t border-[var(--uwh-border)] pt-2 text-sm font-bold">
          <span>{t('finances.bilan.totalIncomeExclCarry')}</span>
          <Money value={bilan.totalRecettesHorsReliquat} />
        </div>
      </Card>

      <Card className="print-block">
        <div className="mb-2 flex items-center gap-2 text-[var(--uwh-debit)]">
          <ArrowDownRight size={16} aria-hidden="true" />
          <h3 className="font-display font-bold">
            {t('finances.bilan.expenses')}
          </h3>
        </div>
        <LinesTable lines={bilan.depenses} hideCompensated={hideCompensated} />
        <div className="mt-2 flex items-center justify-between border-t border-[var(--uwh-border)] pt-2 text-sm font-bold">
          <span>{t('finances.bilan.totalExpenses')}</span>
          <Money value={bilan.totalDepenses} />
        </div>
      </Card>

      {events.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy
                size={16}
                className="text-[var(--color-puck)]"
                aria-hidden="true"
              />
              <h3 className="font-display font-bold">
                {t('finances.bilan.resultByEvent')}
              </h3>
            </div>
            <Button
              variant="ghost"
              aria-label={t('finances.bilan.manageEventsAria')}
              onClick={() => setManageEvents(true)}
            >
              <Settings2 size={16} aria-hidden="true" />{' '}
              {t('finances.bilan.manage')}
            </Button>
          </div>
          <ul className="divide-y divide-[var(--uwh-border)]">
            {events.map(ev => (
              <li
                key={ev.event.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {ev.event.name}
                  </p>
                  <p className="text-xs text-[var(--uwh-text-soft)]">
                    +{ev.recettes.toLocaleString(getDefaultLocale())} € / −
                    {ev.depenses.toLocaleString(getDefaultLocale())} €
                  </p>
                </div>
                <Money value={ev.net} signed className="shrink-0" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {events.length === 0 && (
        <Card className="no-print flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--uwh-text-soft)]">
            {t('finances.bilan.eventsHint')}
          </span>
          <Button variant="secondary" onClick={() => setManageEvents(true)}>
            <Trophy size={16} aria-hidden="true" /> {t('finances.bilan.events')}
          </Button>
        </Card>
      )}

      <div className="flex gap-2 no-print">
        <Link to="/finances/journal" className="flex-1">
          <Button variant="secondary" block>
            <Calculator size={18} aria-hidden="true" />{' '}
            {t('finances.bilan.viewLedger')}
          </Button>
        </Link>
        <Link to="/audit" className="flex-1">
          <Button variant="ghost" block>
            {t('finances.bilan.auditLog')}
          </Button>
        </Link>
      </div>

      <EventsSheet open={manageEvents} onClose={() => setManageEvents(false)} />
    </div>
  );
}
