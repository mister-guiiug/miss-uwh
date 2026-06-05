// Miss UWH — Edge Function : importe les adhésions/licences HelloAsso dans la
// table `adherents` (saison active). Le secret HelloAsso ne quitte JAMAIS le
// serveur. Les écritures passent par le JWT de l'utilisateur appelant → la RLS
// décide (seuls trésorier/secrétaire/président/admin peuvent écrire les adhérents).
//
// Secrets à définir (Dashboard Supabase → Edge Functions → Secrets, ou
// `supabase secrets set ...`) :
//   HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET  (confidentiels, obligatoires)
//   HELLOASSO_ORG_SLUG, HELLOASSO_FORM_SLUG, HELLOASSO_FORM_TYPE (optionnels :
//   servent de repli si l'app ne fournit pas les slugs dans la requête).
// L'organisation et le formulaire sont de préférence paramétrés DANS l'app
// (Réglages → Intégration HelloAsso) et transmis ici via le corps de la requête.
// SUPABASE_URL / SUPABASE_ANON_KEY sont injectés automatiquement.
//
// Déploiement : `supabase functions deploy helloasso-sync`
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: 'Non authentifié.' }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      seasonId?: string;
      orgSlug?: string;
      formSlug?: string;
      formType?: string;
    };
    const seasonId = body.seasonId;
    if (!seasonId) return json({ error: 'seasonId requis.' }, 400);

    // Identifiants OAuth : secrets serveur uniquement.
    const clientId = Deno.env.get('HELLOASSO_CLIENT_ID');
    const clientSecret = Deno.env.get('HELLOASSO_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return json(
        {
          error:
            'Identifiants HelloAsso manquants (secrets serveur non définis).',
        },
        500
      );
    }

    // Organisation / formulaire : paramétrés dans l'app (corps de la requête),
    // avec repli sur d'éventuels secrets serveur.
    const orgSlug = (
      body.orgSlug ||
      Deno.env.get('HELLOASSO_ORG_SLUG') ||
      ''
    ).trim();
    const formSlug = (
      body.formSlug ||
      Deno.env.get('HELLOASSO_FORM_SLUG') ||
      ''
    ).trim();
    const formType = (
      body.formType ||
      Deno.env.get('HELLOASSO_FORM_TYPE') ||
      'Membership'
    ).trim();
    if (!orgSlug || !formSlug) {
      return json(
        {
          error:
            'Organisation / formulaire HelloAsso non renseignés (Réglages → Intégration HelloAsso).',
        },
        400
      );
    }

    // 1) Jeton HelloAsso (OAuth2 client credentials).
    const tokenRes = await fetch('https://api.helloasso.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!tokenRes.ok) {
      return json({ error: 'Authentification HelloAsso échouée.' }, 502);
    }
    const { access_token } = await tokenRes.json();

    // 2) Participants du formulaire d'adhésion (pagination).
    type Item = {
      amount?: number;
      user?: { firstName?: string; lastName?: string };
      payer?: { firstName?: string; lastName?: string; email?: string };
    };
    const items: Item[] = [];
    for (let page = 1; page <= 50; page++) {
      const url =
        `https://api.helloasso.com/v5/organizations/${orgSlug}` +
        `/forms/${formType}/${formSlug}/items?pageSize=100&pageIndex=${page}`;
      const r = await fetch(url, {
        headers: { authorization: `Bearer ${access_token}` },
      });
      if (!r.ok) {
        if (page === 1)
          return json({ error: 'Lecture HelloAsso échouée.' }, 502);
        break;
      }
      const data = await r.json();
      items.push(...((data.data ?? []) as Item[]));
      const pag = data.pagination ?? {};
      if (!pag.totalPages || page >= pag.totalPages) break;
    }

    // 3) Upsert adhérents via le JWT utilisateur (RLS appliquée).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    for (const it of items) {
      const firstName = (
        it.user?.firstName ??
        it.payer?.firstName ??
        ''
      ).trim();
      const lastName = (it.user?.lastName ?? it.payer?.lastName ?? '').trim();
      const email = (it.payer?.email ?? '').trim() || null;
      const amount = Math.round(it.amount ?? 0) / 100; // centimes → €
      if (!firstName && !lastName) {
        skipped++;
        continue;
      }

      let existingId: string | null = null;
      if (email) {
        const { data } = await supabase
          .from('adherents')
          .select('id')
          .eq('season_id', seasonId)
          .eq('email', email)
          .limit(1);
        existingId = data?.[0]?.id ?? null;
      }

      if (existingId) {
        const { error } = await supabase
          .from('adherents')
          .update({ amount, paid: true })
          .eq('id', existingId);
        if (error)
          return json({ error: `Écriture refusée : ${error.message}` }, 403);
        updated++;
      } else {
        const { error } = await supabase.from('adherents').insert({
          season_id: seasonId,
          first_name: firstName || '—',
          last_name: lastName || '—',
          email,
          amount,
          paid: true,
          status: 'actif',
        });
        if (error)
          return json({ error: `Écriture refusée : ${error.message}` }, 403);
        imported++;
      }
    }

    return json({ imported, updated, skipped, total: items.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
