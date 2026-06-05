import { useMemo, useState } from 'react';
import { CalendarDays, Download, MapPin, Plus } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  CLUB_EVENT_TYPE_LABELS,
  type ClubEvent,
} from '../../shared/types/domain.ts';
import { IS_SUPABASE } from '../../backend/config.ts';
import { fetchGoogleCalendar } from '../../backend/gcal.ts';
import { downloadClubEventsIcs } from '../export/icalExport.ts';
import { formatDateShort } from '../../shared/lib/format.ts';
import { Button } from '../../shared/components/Button.tsx';
import { Badge } from '../../shared/components/badges.tsx';
import { EmptyState } from '../../shared/components/EmptyState.tsx';
import { ClubEventSheet } from './ClubEventSheet.tsx';

/** Agenda de la vie du club (réunions, sorties, AG, soirées…). */
export function EvenementsScreen() {
  const season = useAppStore(selectActiveSeason);
  const all = useAppStore(s => s.data.clubEvents);
  const addClubEvent = useAppStore(s => s.addClubEvent);
  const club = useAppStore(s => s.data.club);
  const icsUrl = useAppStore(s => s.data.settings.googleCalendar?.icsUrl);
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string>();

  async function runGcalImport() {
    setImporting(true);
    setImportMsg(undefined);
    try {
      const events = await fetchGoogleCalendar(icsUrl ?? '');
      // Dédoublonnage par (date + titre) sur la saison active.
      const seen = new Set(
        all
          .filter(e => e.seasonId === season.id)
          .map(e => `${e.date}|${e.title}`)
      );
      let imported = 0;
      let skipped = 0;
      for (const ev of events) {
        const key = `${ev.date}|${ev.title}`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        addClubEvent({
          seasonId: season.id,
          date: ev.date,
          title: ev.title,
          type: 'autre',
          location: ev.location,
          description: ev.description,
        });
        imported++;
      }
      setImportMsg(
        events.length === 0
          ? 'Google Agenda : aucun événement trouvé.'
          : `Google Agenda : ${imported} ajout(s)` +
              (skipped ? `, ${skipped} déjà présent(s)` : '') +
              '.'
      );
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Import impossible.');
    } finally {
      setImporting(false);
    }
  }

  const rows = useMemo(
    () =>
      all
        .filter(e => e.seasonId === season.id)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [all, season.id]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {rows.length} événement{rows.length > 1 ? 's' : ''}
        </h2>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <Button
              variant="secondary"
              aria-label="Exporter l'agenda au format iCal (.ics)"
              onClick={() =>
                downloadClubEventsIcs(rows, `${club.name} — ${season.label}`)
              }
            >
              <Download size={18} aria-hidden="true" />
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" /> Événement
          </Button>
        </div>
      </div>

      {IS_SUPABASE && (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            disabled={importing || !icsUrl}
            onClick={() => void runGcalImport()}
          >
            <Download size={16} aria-hidden="true" />
            {importing ? 'Import en cours…' : 'Importer depuis Google Agenda'}
          </Button>
          {!icsUrl && (
            <p className="text-xs text-[var(--uwh-text-soft)]">
              Renseignez l'URL iCal dans Réglages → Intégration Google Agenda.
            </p>
          )}
          {importMsg && (
            <p className="text-xs text-[var(--uwh-text-soft)]">{importMsg}</p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState Icon={CalendarDays} title="Agenda vide">
          Planifiez réunions, sorties, AG et soirées de la saison {season.label}
          .
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(e => (
            <li key={e.id}>
              <button
                onClick={() => setEditing(e)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface)] p-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--uwh-text-soft)]">
                    <Badge tone="primary">
                      {CLUB_EVENT_TYPE_LABELS[e.type]}
                    </Badge>
                    <span>{formatDateShort(e.date)}</span>
                    {e.location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin size={11} aria-hidden="true" />
                        <span className="truncate">{e.location}</span>
                      </span>
                    )}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <ClubEventSheet open event={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <ClubEventSheet open event={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
