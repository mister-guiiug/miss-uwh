/**
 * Rappels d'échéances — licences et certificats médicaux — dans l'agenda de
 * celui qui a fermé l'app. Les alertes de l'app (`features/alerts`) ne
 * parlent qu'à qui l'ouvre ; un fichier `.ics` importé dans son agenda sonne
 * sans elle.
 *
 * Écrit par le module `ical` du socle, qui sait depuis la 6.16.0 poser des
 * rappels `VALARM` — et seulement sur demande : c'est l'objet même de cet
 * export (cf. `docs/DONNEES.md` du socle).
 *
 * CE QUI EST DÉCIDÉ ICI :
 *  - UN ÉVÉNEMENT PAR ÉCHÉANCE, en journée entière : la donnée est une date
 *    sans heure (le formulaire n'en propose aucune), et c'est la seule forme
 *    qui ne glisse pas d'un jour chez un lecteur d'un autre fuseau.
 *  - DEUX RAPPELS, comptés depuis le début de l'événement — minuit :
 *    un mois avant à 9 h, puis la veille à 9 h. « Un mois » vaut 30 jours :
 *    `TRIGGER` est une DURÉE (RFC 5545 §3.8.6.3), et une durée ne connaît pas
 *    le mois calendaire.
 *  - UN `UID` STABLE : adhérent + nature + date. Réimporter le fichier met les
 *    événements à jour au lieu de les dupliquer ; une échéance renouvelée
 *    (nouvelle date) en est une nouvelle, et l'ancienne, passée, reste où elle
 *    est.
 *
 * Importé à la demande (`import()` depuis l'écran des membres) : rien de ceci
 * n'entre dans le premier chargement.
 */
import { downloadText } from '@mister-guiiug/dev-pwa-config/download';
import {
  ICAL_MIME,
  toIcalendar,
  type IcalEvent,
} from '@mister-guiiug/dev-pwa-config/ical';
import type { Deadline, DeadlineKind } from '../../shared/lib/expiry.ts';
import type { TKey, Translate } from '../../i18n/index.ts';

/** Le logiciel qui a écrit le fichier — distinct de l'export de l'agenda. */
const PROD_ID = '-//Miss UWH//Echeances//FR';

/** Suffixe d'`UID`, le même que l'agenda du club : l'app, pas l'export. */
const UID_DOMAIN = 'miss-uwh';

/** Un mois avant, à 9 h : 30 jours avant minuit, moins 9 heures. */
export const MONTH_BEFORE_AT_9 = 30 * 24 * 60 - 9 * 60;

/** La veille à 9 h : sur une journée entière, le début est minuit. */
export const DAY_BEFORE_AT_9 = 24 * 60 - 9 * 60;

/** Le segment d'`UID` de chaque nature — FIGÉ : il fait l'identité. */
const UID_KIND: Record<DeadlineKind, string> = {
  licence: 'licence',
  medicalCert: 'certificat-medical',
};

const WHAT_KEY: Record<DeadlineKind, TKey> = {
  licence: 'adherents.deadlines.whatLicence',
  medicalCert: 'adherents.deadlines.whatMedicalCert',
};

/** `echeance-<adhérent>-<nature>-<date>` : réimporter met à jour. */
export function deadlineUid(deadline: Deadline): string {
  return `echeance-${deadline.adherent.id}-${UID_KIND[deadline.kind]}-${deadline.date}`;
}

/**
 * Une échéance → un événement d'agenda, avec ses deux rappels. Pur : le
 * traducteur est passé, pour que l'agenda parle la langue de l'app.
 */
export function deadlineToIcal(deadline: Deadline, t: Translate): IcalEvent {
  const { adherent } = deadline;
  const what = t(WHAT_KEY[deadline.kind], {
    name: `${adherent.firstName} ${adherent.lastName}`.trim(),
  });
  const number =
    deadline.kind === 'licence' ? adherent.licenceNumber?.trim() : undefined;
  return {
    uid: deadlineUid(deadline),
    start: deadline.date,
    allDay: true,
    summary: t('adherents.deadlines.summary', { what }),
    ...(number
      ? { description: t('adherents.deadlines.licenceNumber', { number }) }
      : {}),
    // Un rappel n'occupe pas l'agenda : la journée reste libre.
    transparent: true,
    alarms: [
      {
        minutesBefore: MONTH_BEFORE_AT_9,
        description: t('adherents.deadlines.alarmMonth', { what }),
      },
      {
        minutesBefore: DAY_BEFORE_AT_9,
        description: t('adherents.deadlines.alarmDay', { what }),
      },
    ],
  };
}

/** Le `.ics` complet. Pur : `dtstamp` injectable rend l'export comparable. */
export function buildDeadlinesIcs(
  deadlines: readonly Deadline[],
  opts: { calName: string; t: Translate; dtstamp?: string }
): string {
  return toIcalendar(deadlines, {
    name: opts.calName,
    prodId: PROD_ID,
    uidDomain: UID_DOMAIN,
    dtstamp: opts.dtstamp,
    map: deadline => deadlineToIcal(deadline, opts.t),
  });
}

/** Le nom du fichier : le club, la saison, et ce que c'est. */
export function deadlinesFileName(
  club: string,
  season: string,
  t: Translate
): string {
  const slug = `${club} ${season}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'club'}-${t('adherents.deadlines.fileSuffix')}.ics`;
}

export function downloadDeadlinesIcs(
  deadlines: readonly Deadline[],
  names: { club: string; season: string },
  t: Translate
): void {
  downloadText(
    buildDeadlinesIcs(deadlines, {
      calName: t('adherents.deadlines.calName', names),
      t,
    }),
    deadlinesFileName(names.club, names.season, t),
    ICAL_MIME
  );
}
