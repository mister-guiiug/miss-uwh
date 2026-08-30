/**
 * Ce que ces tests gardent, et ce qu'ils ont laissé partir.
 *
 * La mécanique du format (échappement §3.3.11, pliage à 75 octets §3.1, CRLF,
 * `DTEND` exclusif d'une journée entière) appartient désormais à
 * `@mister-guiiug/dev-wpa-config/ical`, qui la teste chez lui. La retester ici
 * reviendrait à tester la même fonction deux fois.
 *
 * Restent les questions auxquelles le socle ne peut pas répondre à la place de
 * l'app : QUELS événements partent, QUELS champs du domaine on leur accroche,
 * sous quelle NATURE de date, et sous quel `UID` — celui dont dépend la mise à
 * jour d'un agenda déjà importé. Ils lisent le `.ics` réellement produit.
 */
import { describe, expect, it } from 'vitest';
import { unescapeText, unfoldLines } from '@mister-guiiug/dev-wpa-config/ical';
import type { ClubEvent } from '../../shared/types/domain.ts';
import { buildIcs, clubEventToIcal } from './icalExport.ts';

const ev = (over: Partial<ClubEvent> = {}): ClubEvent => ({
  id: 'e1',
  seasonId: 's1',
  date: '2026-01-31',
  title: 'Assemblée générale',
  type: 'ag',
  ...over,
});

const DTSTAMP = '20260101T120000Z';

/**
 * Relit un `.ics` comme le ferait un client d'agenda : dépliage d'abord (une
 * propriété peut tenir sur plusieurs lignes), puis une propriété par événement.
 */
function readEvents(ics: string): Array<Record<string, string>> {
  const events: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;
  for (const line of unfoldLines(ics)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      // `DTSTART;VALUE=DATE` : le nom s'arrête au premier `;`.
      const name = line.slice(0, colon).split(';')[0] ?? '';
      current[name] = unescapeText(line.slice(colon + 1));
    }
  }
  return events;
}

describe('clubEventToIcal', () => {
  it('accroche les champs du domaine et déclare la journée entière', () => {
    expect(
      clubEventToIcal(ev({ location: 'Piscine', description: 'Ordre du jour' }))
    ).toEqual({
      uid: 'e1',
      start: '2026-01-31',
      allDay: true,
      summary: 'Assemblée générale',
      location: 'Piscine',
      description: 'Ordre du jour',
    });
  });

  it("n'invente pas les champs que l'utilisateur n'a pas remplis", () => {
    const mapped = clubEventToIcal(ev());
    expect(mapped.location).toBeUndefined();
    expect(mapped.description).toBeUndefined();
  });
});

describe('buildIcs', () => {
  it('exporte un VEVENT par événement fourni, dans l’ordre reçu', () => {
    const ics = buildIcs(
      [
        ev({ id: 'a', title: 'Réunion de bureau' }),
        ev({ id: 'b', title: 'Sortie fosse', date: '2026-03-14' }),
      ],
      { dtstamp: DTSTAMP }
    );
    expect(readEvents(ics).map(e => e.SUMMARY)).toEqual([
      'Réunion de bureau',
      'Sortie fosse',
    ]);
  });

  it('rend au trésorier ce qu’il a saisi, ponctuation comprise', () => {
    const title =
      'Soirée; tournoi, fin\nbuvette — et un titre volontairement très long pour être replié';
    const ics = buildIcs(
      [
        ev({
          title,
          location: 'Piscine, bassin nordique',
          description: 'Repas à 20 h ; prévoir 12 €',
        }),
      ],
      { dtstamp: DTSTAMP }
    );
    const [read] = readEvents(ics);
    expect(read?.SUMMARY).toBe(title);
    expect(read?.LOCATION).toBe('Piscine, bassin nordique');
    expect(read?.DESCRIPTION).toBe('Repas à 20 h ; prévoir 12 €');
  });

  it('omet les propriétés dont le champ du domaine est vide', () => {
    const [read] = readEvents(buildIcs([ev()], { dtstamp: DTSTAMP }));
    expect(read).not.toHaveProperty('LOCATION');
    expect(read).not.toHaveProperty('DESCRIPTION');
  });

  it("exporte le jour du calendrier, sans inventer d'heure", () => {
    // La décision documentée dans icalExport.ts : le domaine n'a pas d'heure,
    // l'écran affiche « 31/01/2026 ». Un instant UTC afficherait 01:00, et la
    // veille pour un lecteur à l'ouest de Greenwich.
    const ics = buildIcs([ev()], { dtstamp: DTSTAMP });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260131');
    expect(readEvents(ics)[0]?.DTSTART).toBe('20260131');
  });

  it("reconduit le PRODID et le motif d'UID, pour qu'un réimport mette à jour", () => {
    // Changer l'un ou l'autre ferait apparaître les événements EN DOUBLE chez
    // un abonné qui a déjà importé l'agenda.
    const ics = buildIcs([ev({ id: 'e42' })], {
      calName: 'CHS — 2025/2026',
      dtstamp: DTSTAMP,
    });
    expect(ics).toContain('PRODID:-//Miss UWH//Agenda//FR');
    expect(readEvents(ics)[0]?.UID).toBe('e42@miss-uwh');
    expect(ics).toContain('X-WR-CALNAME:CHS — 2025/2026');
  });

  it('horodate le fichier une seule fois, avec la date de fabrication fournie', () => {
    const ics = buildIcs([ev({ id: 'a' }), ev({ id: 'b' })], {
      dtstamp: DTSTAMP,
    });
    expect(readEvents(ics).map(e => e.DTSTAMP)).toEqual([DTSTAMP, DTSTAMP]);
  });
});
