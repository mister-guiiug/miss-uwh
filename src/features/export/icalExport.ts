/**
 * Export iCalendar (RFC 5545) de l'agenda de la vie du club : un fichier `.ics`
 * partageable / importable dans Google Agenda, Outlook, Apple Calendar…
 *
 * BASCULÉ SUR `@mister-guiiug/dev-pwa-config/ical` (socle 3.24.0). Le module du
 * socle est né de QUATRE réécritures de la RFC 5545 dans la famille, dont
 * celle-ci : il a repris d'ici la journée entière et le `DTSTAMP` injectable,
 * et il corrige ce que le pliage local ratait (cf. plus bas). Il ne reste donc
 * dans ce fichier que ce qui est propre à miss-uwh : la conversion d'un
 * `ClubEvent` en événement d'agenda, et le nom du fichier téléchargé.
 *
 * POURQUOI DES JOURNÉES ENTIÈRES (`VALUE=DATE`) ET PAS DES INSTANTS. Le socle
 * sait écrire trois natures de date — instant UTC, heure locale flottante,
 * journée entière — et le choix n'est pas cosmétique. Ici il est dicté par le
 * domaine : `ClubEvent.date` est une date ISO `yyyy-mm-dd`, sans heure, et le
 * formulaire de saisie n'en propose aucune (cf. ClubEventSheet). Il n'y a donc
 * aucune heure à écrire, et en inventer une (minuit) la rendrait fausse deux
 * fois : l'AG s'afficherait « 31 janvier, 01:00 » à Paris, et carrément le
 * 30 janvier pour un lecteur à l'ouest de Greenwich — alors que la liste des
 * événements, elle, affiche `formatDateShort` (« 31/01/2026 »), un jour de
 * calendrier qui ne bouge nulle part. La journée entière est la seule des trois
 * formes qui ne contredit pas l'écran.
 *
 * CE QUI EST RECONDUIT À L'IDENTIQUE, ET POURQUOI. `PRODID` et le motif d'`UID`
 * (`<id>@miss-uwh`) sont repassés en options au socle. Un `UID` est la seule
 * propriété dont la valeur doit survivre aux versions : un abonné qui a déjà
 * importé l'agenda verrait ses événements EN DOUBLE si on changeait le motif,
 * au lieu de les voir mis à jour. Le nom du fichier téléchargé ne bouge pas non
 * plus.
 */
import { downloadText } from '@mister-guiiug/dev-pwa-config/download';
import {
  ICAL_MIME,
  toIcalendar,
  type IcalEvent,
} from '@mister-guiiug/dev-pwa-config/ical';
import type { ClubEvent } from '../../shared/types/domain.ts';

/** Le logiciel qui a écrit le fichier — inchangé depuis le premier export. */
const PROD_ID = '-//Miss UWH//Agenda//FR';

/**
 * Suffixe d'`UID`, inchangé lui aussi : c'est lui qui fait qu'un réimport MET À
 * JOUR les événements au lieu d'en créer une seconde collection.
 */
const UID_DOMAIN = 'miss-uwh';

/** Nom du calendrier importé quand l'appelant n'en fournit pas. */
const DEFAULT_CAL_NAME = 'Miss UWH';

/**
 * Le mapping métier : un événement du club → un événement d'agenda. Pur, c'est
 * là qu'est la valeur de l'app — le reste (échappement, pliage, CRLF,
 * `DTEND` exclusif au lendemain) est garanti et testé par le socle.
 *
 * `allDay` est explicite bien que le socle le déduise d'une date sans heure :
 * le jour où `ClubEvent.date` gagnerait une heure, l'export doit continuer à
 * dire ce que l'app affiche, pas suivre la forme de la donnée en silence.
 */
export function clubEventToIcal(event: ClubEvent): IcalEvent {
  return {
    uid: event.id,
    start: event.date,
    allDay: true,
    summary: event.title,
    location: event.location,
    description: event.description,
  };
}

/** Le `.ics` complet. Pur : `dtstamp` injectable rend l'export comparable. */
export function buildIcs(
  events: readonly ClubEvent[],
  opts: { calName?: string; dtstamp?: string } = {}
): string {
  return toIcalendar(events, {
    name: opts.calName ?? DEFAULT_CAL_NAME,
    prodId: PROD_ID,
    uidDomain: UID_DOMAIN,
    dtstamp: opts.dtstamp,
    map: clubEventToIcal,
  });
}

export function downloadClubEventsIcs(
  events: readonly ClubEvent[],
  calName: string
): void {
  downloadText(
    buildIcs(events, { calName }),
    `${calName.replace(/[^\w-]+/g, '-').toLowerCase()}-agenda.ics`,
    ICAL_MIME
  );
}
