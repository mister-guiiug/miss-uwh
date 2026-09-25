/**
 * Les rappels d'échéances, lus dans le `.ics` réellement produit — comme un
 * client d'agenda le lirait. La mécanique du format (échappement, pliage,
 * CRLF, `DTEND` exclusif, écriture des `VALARM`) appartient au socle et y est
 * testée ; restent les questions de l'app : QUELLES échéances partent, sous
 * quel `UID`, avec QUELS rappels, et dans quelle langue.
 */
import { describe, expect, it } from 'vitest';
import { createTranslator } from '@mister-guiiug/dev-pwa-config/react/i18n';
import { unescapeText, unfoldLines } from '@mister-guiiug/dev-pwa-config/ical';
import type { Adherent } from '../../shared/types/domain.ts';
import { upcomingDeadlines, type Deadline } from '../../shared/lib/expiry.ts';
import { messages } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/index.ts';
import {
  DAY_BEFORE_AT_9,
  MONTH_BEFORE_AT_9,
  buildDeadlinesIcs,
  deadlineToIcal,
  deadlineUid,
  deadlinesFileName,
} from './deadlinesIcs.ts';

const fr: Translate = createTranslator(messages, 'fr', 'fr');
const en: Translate = createTranslator(messages, 'en', 'fr');

const DTSTAMP = '20260925T080000Z';
const TODAY = new Date(2026, 8, 25); // 25 septembre 2026

const adherent = (over: Partial<Adherent> = {}): Adherent => ({
  id: 'a1',
  seasonId: 's1',
  firstName: 'Léa',
  lastName: 'Martin',
  category: 'adulte',
  amount: 0,
  paid: true,
  ...over,
});

interface ReadEvent {
  props: Record<string, string>;
  alarms: Array<Record<string, string>>;
}

/**
 * Relit un `.ics` : dépliage d'abord, puis une propriété par événement, et
 * les rappels à part.
 */
function readEvents(ics: string): ReadEvent[] {
  const events: ReadEvent[] = [];
  let current: ReadEvent | null = null;
  let alarm: Record<string, string> | null = null;
  for (const line of unfoldLines(ics)) {
    if (line === 'BEGIN:VEVENT') current = { props: {}, alarms: [] };
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (line === 'BEGIN:VALARM') alarm = {};
    else if (line === 'END:VALARM') {
      if (alarm && current) current.alarms.push(alarm);
      alarm = null;
    } else if (current) {
      const colon = line.indexOf(':');
      const name = line.slice(0, colon).split(';')[0] ?? '';
      (alarm ?? current.props)[name] = unescapeText(line.slice(colon + 1));
    }
  }
  return events;
}

describe('upcomingDeadlines', () => {
  it('les deux natures, celles de la saison seulement, triées par date', () => {
    const list = upcomingDeadlines(
      [
        adherent({
          id: 'a1',
          licenceExpiry: '2026-12-31',
          medicalCertExpiry: '2026-10-15',
        }),
        adherent({
          id: 'a2',
          firstName: 'Tom',
          lastName: 'Abel',
          licenceExpiry: '2026-10-15',
        }),
        adherent({ id: 'autre', seasonId: 's0', licenceExpiry: '2026-11-01' }),
      ],
      's1',
      TODAY
    );
    expect(list.map(d => `${d.date} ${d.adherent.id} ${d.kind}`)).toEqual([
      // Même date : par nom, Abel avant Martin.
      '2026-10-15 a2 licence',
      '2026-10-15 a1 medicalCert',
      '2026-12-31 a1 licence',
    ]);
  });

  it('écarte le passé et l’illisible, garde aujourd’hui', () => {
    const list = upcomingDeadlines(
      [
        adherent({ licenceExpiry: '2026-09-24', medicalCertExpiry: '' }),
        adherent({
          id: 'a2',
          licenceExpiry: '2026-09-25',
          medicalCertExpiry: 'bientôt',
        }),
      ],
      's1',
      TODAY
    );
    expect(list).toEqual([
      expect.objectContaining({ date: '2026-09-25', kind: 'licence' }),
    ]);
  });

  it('aucune échéance renseignée : une liste vide', () => {
    expect(upcomingDeadlines([adherent()], 's1', TODAY)).toEqual([]);
  });
});

const licence: Deadline = {
  adherent: adherent({ licenceNumber: ' A-123 ' }),
  kind: 'licence',
  date: '2026-10-31',
};
const certificat: Deadline = {
  adherent: adherent(),
  kind: 'medicalCert',
  date: '2026-11-15',
};

describe('deadlineToIcal', () => {
  it('une journée entière, deux rappels : un mois avant à 9 h, la veille à 9 h', () => {
    expect(MONTH_BEFORE_AT_9).toBe(30 * 24 * 60 - 9 * 60);
    expect(DAY_BEFORE_AT_9).toBe(15 * 60);
    expect(deadlineToIcal(licence, fr)).toEqual({
      uid: 'echeance-a1-licence-2026-10-31',
      start: '2026-10-31',
      allDay: true,
      summary: 'Échéance : licence de Léa Martin',
      description: 'Licence n° A-123',
      transparent: true,
      alarms: [
        {
          minutesBefore: MONTH_BEFORE_AT_9,
          description: 'Dans un mois — échéance : licence de Léa Martin',
        },
        {
          minutesBefore: DAY_BEFORE_AT_9,
          description: 'Demain — échéance : licence de Léa Martin',
        },
      ],
    });
  });

  it('un certificat n’a pas de numéro à décrire', () => {
    const event = deadlineToIcal(certificat, fr);
    expect(event.summary).toBe('Échéance : certificat médical de Léa Martin');
    expect(event).not.toHaveProperty('description');
  });

  it('parle la langue de l’app', () => {
    const event = deadlineToIcal(certificat, en);
    expect(event.summary).toBe("Expiry: Léa Martin's medical certificate");
    expect(event.alarms?.map(a => a.description)).toEqual([
      "In one month — expiry: Léa Martin's medical certificate",
      "Tomorrow — expiry: Léa Martin's medical certificate",
    ]);
  });

  it('l’UID : adhérent + nature + date, et rien d’autre', () => {
    // Le nom change, l'UID non : un réimport met l'événement à jour.
    const renamed: Deadline = {
      ...licence,
      adherent: { ...licence.adherent, lastName: 'Durand' },
    };
    expect(deadlineUid(renamed)).toBe(deadlineUid(licence));
    // Une autre nature, ou une autre date, est une autre échéance.
    expect(deadlineUid({ ...licence, kind: 'medicalCert' })).toBe(
      'echeance-a1-certificat-medical-2026-10-31'
    );
    expect(deadlineUid({ ...licence, date: '2027-10-31' })).not.toBe(
      deadlineUid(licence)
    );
  });
});

describe('buildDeadlinesIcs', () => {
  const ics = buildDeadlinesIcs([licence, certificat], {
    calName: 'CHS — échéances 2025-2026',
    t: fr,
    dtstamp: DTSTAMP,
  });
  const [first, second] = readEvents(ics);

  it('un VEVENT par échéance, en journée entière, jour de fin exclusif', () => {
    expect(readEvents(ics)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261031');
    expect(ics).toContain('DTEND;VALUE=DATE:20261101');
    expect(first?.props.SUMMARY).toBe('Échéance : licence de Léa Martin');
    expect(first?.props.TRANSP).toBe('TRANSPARENT');
  });

  it('les deux rappels sont des VALARM d’affichage, aux bons décalages', () => {
    expect(first?.alarms).toEqual([
      {
        ACTION: 'DISPLAY',
        DESCRIPTION: 'Dans un mois — échéance : licence de Léa Martin',
        // 30 jours avant minuit, moins 9 h : le 1er octobre à 9 h.
        TRIGGER: '-P29DT15H',
      },
      {
        ACTION: 'DISPLAY',
        DESCRIPTION: 'Demain — échéance : licence de Léa Martin',
        // La veille à 9 h.
        TRIGGER: '-PT15H',
      },
    ]);
    expect(second?.alarms.map(a => a.TRIGGER)).toEqual(['-P29DT15H', '-PT15H']);
  });

  it('UID stable, suffixé de l’app, et en-tête du calendrier', () => {
    expect(first?.props.UID).toBe('echeance-a1-licence-2026-10-31@miss-uwh');
    expect(second?.props.UID).toBe(
      'echeance-a1-certificat-medical-2026-11-15@miss-uwh'
    );
    expect(ics).toContain('PRODID:-//Miss UWH//Echeances//FR');
    expect(ics).toContain('X-WR-CALNAME:CHS — échéances 2025-2026');
    expect(first?.props.DTSTAMP).toBe(DTSTAMP);
  });

  it('deux exports du même registre rendent les mêmes UID : un réimport met à jour', () => {
    const again = buildDeadlinesIcs([licence, certificat], {
      calName: 'autre nom',
      t: en,
      dtstamp: '20261001T080000Z',
    });
    expect(readEvents(again).map(e => e.props.UID)).toEqual(
      readEvents(ics).map(e => e.props.UID)
    );
  });

  it('aucune échéance : un calendrier valide, vide', () => {
    const empty = buildDeadlinesIcs([], {
      calName: 'x',
      t: fr,
      dtstamp: DTSTAMP,
    });
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(readEvents(empty)).toEqual([]);
  });
});

describe('deadlinesFileName', () => {
  it('club et saison sans accents ni espaces, et la nature traduite', () => {
    expect(deadlinesFileName('Clermont Hockey Sub', '2025-2026', fr)).toBe(
      'clermont-hockey-sub-2025-2026-echeances.ics'
    );
    expect(deadlinesFileName('Club Élan', '2025/2026', en)).toBe(
      'club-elan-2025-2026-expiries.ics'
    );
    expect(deadlinesFileName('', '', fr)).toBe('club-echeances.ics');
  });
});
