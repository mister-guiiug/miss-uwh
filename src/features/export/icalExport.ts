/**
 * Export iCal (RFC 5545) de l'agenda de la vie du club : génère un fichier
 * `.ics` d'événements « journée » (VALUE=DATE) partageable / importable dans
 * Google Agenda, Outlook, Apple Calendar… `buildIcs` est pur (testable) ;
 * `downloadClubEventsIcs` déclenche le téléchargement.
 */
import type { ClubEvent } from '../../shared/types/domain.ts';

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** « 2025-01-31 » → « 20250131 ». */
function ymd(iso: string): string {
  return iso.replace(/-/g, '');
}

/** Lendemain au format compact (DTEND exclusif pour un événement « journée »). */
function nextDayCompact(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Repli de ligne RFC 5545 (≤ 75 octets ; continuation par espace). */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

export function buildIcs(
  events: ClubEvent[],
  opts: { calName?: string; dtstamp?: string } = {}
): string {
  const dtstamp =
    opts.dtstamp ??
    new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Miss UWH//Agenda//FR',
    'CALSCALE:GREGORIAN',
    fold(`X-WR-CALNAME:${escapeText(opts.calName ?? 'Miss UWH')}`),
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@miss-uwh`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDayCompact(e.date)}`);
    lines.push(fold(`SUMMARY:${escapeText(e.title)}`));
    if (e.location) lines.push(fold(`LOCATION:${escapeText(e.location)}`));
    if (e.description) {
      lines.push(fold(`DESCRIPTION:${escapeText(e.description)}`));
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadClubEventsIcs(
  events: ClubEvent[],
  calName: string
): void {
  const ics = buildIcs(events, { calName });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${calName.replace(/[^\w-]+/g, '-').toLowerCase()}-agenda.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
