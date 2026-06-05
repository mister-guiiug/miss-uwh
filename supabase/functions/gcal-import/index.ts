// Miss UWH — Edge Function : proxy de lecture d'un calendrier Google PUBLIC au
// format iCal (.ics). Le navigateur ne peut pas lire l'URL directement (pas
// d'en-têtes CORS côté Google) : cette fonction télécharge le .ics côté serveur,
// le parse, et renvoie les événements en JSON. Aucune écriture en base —
// l'insertion dans l'agenda se fait côté client (local-first).
//
// Aucun secret requis : l'URL iCal est publique et fournie par l'app (Réglages →
// Intégration Google Agenda). L'accès est restreint à `calendar.google.com`
// (https) pour éviter tout détournement en proxy ouvert (SSRF).
//
// Déploiement : `supabase functions deploy gcal-import`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

interface IcsEvent {
  uid?: string;
  date: string;
  title: string;
  location?: string;
  description?: string;
}

/** Déplie les lignes repliées (RFC 5545 : CRLF + espace/tab = continuation). */
function unfold(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

/** Déséchappe le texte iCal (\n, \, \; \\). */
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/** « 20250131 » ou « 20250131T180000Z » → « 2025-01-31 ». */
function icsDateToIso(raw: string): string | null {
  const m = raw.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text).split('\n');
  const events: IcsEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const date = cur.DTSTART ? icsDateToIso(cur.DTSTART) : null;
        const title = cur.SUMMARY ? unescapeText(cur.SUMMARY) : '';
        if (date && title) {
          events.push({
            uid: cur.UID,
            date,
            title,
            location: cur.LOCATION ? unescapeText(cur.LOCATION) : undefined,
            description: cur.DESCRIPTION
              ? unescapeText(cur.DESCRIPTION)
              : undefined,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    if (!(name in cur)) cur[name] = line.slice(idx + 1);
  }
  return events;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: 'Non authentifié.' }, 401);

    const body = (await req.json().catch(() => ({}))) as { icsUrl?: string };
    const icsUrl = (body.icsUrl ?? '').trim();
    if (!icsUrl) return json({ error: 'URL iCal requise.' }, 400);

    let parsed: URL;
    try {
      parsed = new URL(icsUrl);
    } catch {
      return json({ error: 'URL invalide.' }, 400);
    }
    // Anti-SSRF : on n'autorise que les adresses iCal publiques de Google.
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'calendar.google.com') {
      return json(
        {
          error:
            'L’URL doit être une adresse iCal publique calendar.google.com (https).',
        },
        400
      );
    }

    const res = await fetch(parsed.toString(), {
      headers: { accept: 'text/calendar' },
    });
    if (!res.ok) {
      return json(
        { error: `Lecture du calendrier échouée (${res.status}).` },
        502
      );
    }
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return json({ error: 'Le contenu n’est pas un calendrier iCal.' }, 422);
    }

    const events = parseIcs(text);
    return json({ events, total: events.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
