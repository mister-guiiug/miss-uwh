import { describe, expect, it } from 'vitest';
import type { ClubEvent } from '../../shared/types/domain.ts';
import { buildIcs } from './icalExport.ts';

const ev = (over: Partial<ClubEvent> = {}): ClubEvent => ({
  id: 'e1',
  seasonId: 's1',
  date: '2026-01-31',
  title: 'Assemblée générale',
  type: 'ag',
  ...over,
});

const DTSTAMP = '20260101T120000Z';

describe('buildIcs', () => {
  it('produit un VCALENDAR avec un VEVENT journée (DTEND = lendemain)', () => {
    const ics = buildIcs([ev({ location: 'Piscine' })], {
      calName: 'CHS',
      dtstamp: DTSTAMP,
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:e1@miss-uwh');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260131');
    expect(ics).toContain('DTEND;VALUE=DATE:20260201'); // exclusif
    expect(ics).toContain('SUMMARY:Assemblée générale');
    expect(ics).toContain('LOCATION:Piscine');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('échappe les caractères spéciaux iCal', () => {
    const ics = buildIcs([ev({ title: 'Soirée; tournoi, fin\nbuvette' })], {
      dtstamp: DTSTAMP,
    });
    expect(ics).toContain('SUMMARY:Soirée\\; tournoi\\, fin\\nbuvette');
  });

  it('gère le passage de mois et omet les champs absents', () => {
    const ics = buildIcs([ev({ date: '2026-02-28' })], { dtstamp: DTSTAMP });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260228');
    expect(ics).toContain('DTEND;VALUE=DATE:20260301');
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
  });
});
