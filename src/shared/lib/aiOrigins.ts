/**
 * Les fournisseurs d'IA que l'app a le droit de joindre depuis le navigateur.
 * SOURCE UNIQUE, lue à deux endroits :
 *  - `vite.config.ts` en fait la directive `connect-src` de la CSP ;
 *  - `aiClient.ts` refuse d'avance un point d'accès hors liste, avec un message
 *    qui dit pourquoi — plutôt que le « Failed to fetch » muet d'un appel que la
 *    CSP a bloqué.
 *
 * LE TROU QUE CETTE LISTE BOUCHE. La génération d'exercices (10/06/2026) appelle
 * Anthropic ou un fournisseur compatible OpenAI depuis le navigateur. La CSP
 * posée le 25/07/2026 ne nommait que Supabase dans `connect-src` : en
 * production, le navigateur refusait chaque appel — et la lecture des
 * justificatifs, qui passe par les mêmes fournisseurs, aurait hérité du refus.
 *
 * Un autre point d'accès compatible (proxy, auto-hébergé) demande d'ajouter son
 * ORIGINE ici : c'est une décision de sécurité, elle se prend dans le code.
 *
 * Aucun import, aucune API du DOM : la config Vite (Node) lit ce fichier.
 */
export const AI_PROVIDER_ORIGINS = [
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://openrouter.ai',
  'https://api.mistral.ai',
  'https://api.groq.com',
] as const;

/** Le point d'accès est-il sur une origine autorisée par la CSP ? */
export function isAllowedAiEndpoint(url: string): boolean {
  try {
    return (AI_PROVIDER_ORIGINS as readonly string[]).includes(
      new URL(url).origin
    );
  } catch {
    return false;
  }
}
