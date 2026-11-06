import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { IS_SUPABASE } from '../backend/config.ts';
import { clearAll as clearSyncQueue, unsentOps } from '../backend/syncQueue.ts';
import { translate, useI18n } from '../i18n/index.ts';
import { getSupabase } from '../lib/supabase.ts';
import { notifyError } from '../shared/lib/toasts.ts';
import { setCurrentActor, useAppStore } from '../store/useAppStore.ts';
import {
  assuranceLevelFromSession,
  mfaChallengeNeeded,
} from '@mister-guiiug/dev-pwa-config/auth/mfa';
import {
  ignoreOfflineSignOut,
  navigateurHorsLigne,
} from '@mister-guiiug/dev-pwa-config/auth/stored-session';
import { readSupabaseSession } from '@mister-guiiug/dev-pwa-config/auth/supabase';
import { AuthContext, type Role, type TotpEnrollment } from './useAuth.ts';
import { oublierRoles, retenirRoles, rolesEnCache } from './rolesCache.ts';

/**
 * COMBIEN DE TEMPS ON ACCEPTE D'ATTENDRE SUPABASE AU DÉMARRAGE.
 *
 * `auth.getSession()` n'est pas une lecture : jeton d'accès périmé — et il ne
 * vit qu'une heure — il part le RENOUVELER contre le réseau, avec des reprises
 * à intervalle croissant bornées par sa propre fenêtre de rafraîchissement,
 * une trentaine de secondes. `navigator.onLine` ne protège que du cas franc :
 * il est vrai derrière un portail captif comme sur un Wi-Fi qui ne route rien.
 */
const ATTENTE_MAX_MS = 5_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(IS_SUPABASE);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);
  const logSecurity = useAppStore(s => s.logSecurity);
  const wipeLocal = useAppStore(s => s.wipeLocal);
  const { t } = useI18n();
  // La question posée avant de jeter la file (cf. `signOut`) : le nombre
  // d'écritures perdues, et la réponse qu'on attend.
  const [perteADecider, setPerteADecider] = useState<{
    n: number;
    repondre: (accord: boolean) => void;
  } | null>(null);

  const refreshMfa = useCallback(async () => {
    if (!IS_SUPABASE) return;
    const sb = await getSupabase();
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const verified = (factors?.totp ?? []).some(f => f.status === 'verified');
    setHasTotp(verified);
    setNeedsMfa(
      verified && aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
    );
  }, []);

  useEffect(() => {
    if (!IS_SUPABASE) return;
    // Client asynchrone (fabrique du socle : SDK importé dynamiquement) :
    // l'abonnement se fait après résolution. Un démontage survenu AVANT est
    // honoré par `disposed` — la continuation s'exécute d'un bloc (mono-thread),
    // donc soit elle voit `disposed`, soit `unsubscribe` est posé avant que le
    // nettoyage ne s'exécute.
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    getSupabase()
      .then(sb => {
        if (disposed) return;

        /**
         * @param depuisLeCache Démarrage sans réseau : on ne DEMANDE rien, on
         * lit ce qui est sur l'appareil. Les deux appels de la branche
         * ordinaire — la table `members` et `refreshMfa` — passent par
         * PostgREST et par l'API MFA, qui commencent l'un comme l'autre par
         * `getSession()` : chacun paierait sa demi-minute avant d'échouer.
         */
        async function hydrate(s: Session | null, depuisLeCache = false) {
          setSession(s);
          if (s?.user?.email) setCurrentActor(s.user.email);
          if (s) {
            if (depuisLeCache) {
              // Les rôles gardent des AFFORDANCES, pas des droits : les rendre
              // vides hors ligne reviendrait à rétrograder le membre à l'écran.
              setRoles(rolesEnCache(s.user.id));
              // Le niveau d'assurance se calcule sur place — le défi TOTP
              // reste donc EXIGÉ sans réseau si la session est en `aal1` avec
              // un facteur vérifié.
              const niveau = assuranceLevelFromSession(s);
              const verifie = (s.user.factors ?? []).some(
                f => f.status === 'verified'
              );
              setHasTotp(verifie);
              setNeedsMfa(mfaChallengeNeeded(niveau));
            } else {
              const { data } = await sb
                .from('members')
                .select('roles')
                .eq('auth_id', s.user.id)
                .maybeSingle();
              const lus = (data?.roles as Role[]) ?? [];
              setRoles(lus);
              retenirRoles(s.user.id, lus);
              await refreshMfa();
            }
          } else {
            setRoles([]);
            setNeedsMfa(false);
            setHasTotp(false);
            setCurrentActor('local');
          }
          setLoading(false);
        }

        /**
         * L'AMORÇAGE NE DOIT JAMAIS DÉPENDRE DU RÉSEAU. Il en dépendait
         * entièrement : `getSession()` était appelé sans condition, et hors
         * ligne avec un jeton périmé il tournait une demi-minute avant de
         * renoncer et d'annoncer « pas de session » — `AuthGate` affichait
         * alors l'écran de CONNEXION, infranchissable sans réseau.
         *
         * Le repli ne dégrade rien quand le réseau est là : c'est la même
         * session, simplement pas encore renouvelée, et `onAuthStateChange`
         * la corrige — `TOKEN_REFRESHED` au retour, `SIGNED_OUT` si le jeton
         * de rafraîchissement a été révoqué.
         */
        void (async () => {
          // Les trois chemins — hors ligne le stockage, en ligne
          // `getSession()` borné, puis le stockage — et la session de CE
          // projet : le socle (`readSupabaseSession`, 6.32.0, promu d'ici).
          const { session, fromStorage } = await readSupabaseSession(sb, {
            timeoutMs: ATTENTE_MAX_MS,
          });
          if (disposed) return;
          await hydrate(session as Session | null, fromStorage);
        })();
        const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
          /**
           * LE SILENCE DU RÉSEAU N'EST PAS UNE DÉCONNEXION.
           *
           * Supabase s'abonne en émettant l'état initial, et cet état passe
           * par le renouvellement du jeton. Hors ligne, il n'aboutit pas : au
           * bout d'une demi-minute la bibliothèque annonce « pas de session »
           * — et le membre, entré depuis trente secondes, se retrouvait
           * éjecté sur l'écran de connexion. C'est ce que faisait encore
           * l'application APRÈS la correction de l'amorçage : elle s'ouvrait
           * en trois secondes, puis se refermait à vingt-six.
           *
           * LA DISTINCTION TIENT AU STOCKAGE, et elle est nette : lors d'une
           * vraie déconnexion, Supabase EFFACE la session avant d'émettre
           * `SIGNED_OUT`. Si elle est encore là, c'est qu'il n'a pas
           * déconnecté qui que ce soit — il a seulement renoncé à joindre le
           * serveur. Vérifié sur un build de production : à t=29 s hors ligne,
           * l'écran de connexion s'affichait alors que la session dormait
           * toujours dans le stockage.
           *
           * Une déconnexion demandée sans réseau reste donc honorée : le
           * stockage est vidé d'abord, la garde ne se déclenche pas. Le
           * socle la tient (`ignoreOfflineSignOut`, 6.32.0, promue d'ici),
           * avec la session de CE projet.
           */
          if (ignoreOfflineSignOut(s, sb)) return;

          void hydrate(s, navigateurHorsLigne());
          if (event === 'SIGNED_IN' && s?.user?.email)
            logSecurity('auth.signin', `Connexion de ${s.user.email}.`);
          // Déconnexion : on purge les données locales (appareil potentiellement
          // partagé) — aucune écriture ne doit subsister pour le membre suivant.
          if (event === 'SIGNED_OUT') {
            // Compté AVANT la purge. Une déconnexion demandée a déjà vidé la
            // file avec l'accord de la personne (`signOut`) : il ne reste
            // rien. Ce qui reste ici, c'est une déconnexion SUBIE — jeton
            // révoqué, session fermée depuis un autre onglet — à laquelle
            // personne n'a pu répondre : on purge quand même, mais on le dit.
            const perdues = unsentOps();
            wipeLocal();
            // L'appareil peut être partagé — un vestiaire, un poste de club :
            // les rôles du membre qui part n'ont rien à faire dans la session
            // du suivant.
            oublierRoles();
            if (perdues > 0)
              notifyError(translate('sync.signedOutLost', { n: perdues }));
          }
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      })
      .catch(() => {
        // SDK injoignable : on sort de l'état de chargement — la connexion
        // resignalera l'erreur au moment où l'utilisateur agit.
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [logSecurity, refreshMfa, wipeLocal]);

  async function signIn(email: string, password: string) {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }

  async function signInWithLink(email: string) {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        // Le retour du lien est calculé depuis l'origine SERVIE, jamais depuis
        // une constante : le même bundle tourne en local et sur Pages. Cette
        // adresse doit figurer dans la liste d'URL autorisées du projet
        // Supabase (Authentication → URL Configuration), qui ne contient que
        // localhost:3000 à la création — sinon le lien part et n'arrive nulle
        // part. `flowType: 'pkce'` (lib/supabase.ts) renvoie `?code=`, que le
        // HashRouter ne touche pas ; un jeton dans le fragment serait perdu.
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        // Les membres sont créés par le club : un lien envoyé à une adresse
        // inconnue ne doit pas fabriquer un compte sans rôle.
        shouldCreateUser: false,
      },
    });
    return { error: error?.message };
  }

  /**
   * LA FILE D'ÉCRITURES NE SURVIT PAS À LA DÉCONNEXION. Elle vit dans le
   * `localStorage` de l'APPAREIL, pas dans le compte : sur le poste du club,
   * les écritures laissées par le membre qui part repartiraient sous la
   * session du suivant — à son nom dans le journal, et sous SES droits.
   *
   * Les jeter est donc obligatoire, mais jamais en silence : ce sont des
   * gestes que la personne croit enregistrés. On les compte et on demande —
   * le geste de mister-doc. Avec l'accord, la file est vidée ICI, avant la
   * déconnexion : `SIGNED_OUT` n'y trouve plus rien, et ne prévient donc pas
   * une seconde fois de ce qui vient d'être accepté.
   */
  async function signOut() {
    const enAttente = unsentOps();
    if (
      enAttente > 0 &&
      !(await new Promise<boolean>(repondre =>
        setPerteADecider({ n: enAttente, repondre })
      ))
    )
      return;
    if (enAttente > 0) clearSyncQueue();
    const sb = await getSupabase();
    await sb.auth.signOut();
  }

  function repondrePerte(accord: boolean) {
    perteADecider?.repondre(accord);
    setPerteADecider(null);
  }

  async function enrollTotp(): Promise<TotpEnrollment | { error: string }> {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
    if (error || !data)
      return { error: error?.message ?? 'Enrôlement impossible' };
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  }

  async function verifyTotp(factorId: string, code: string) {
    const sb = await getSupabase();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (!error) {
      await refreshMfa();
      logSecurity('auth.mfa.verify', 'Vérification MFA (TOTP) réussie.');
    }
    return { error: error?.message };
  }

  async function challengeTotp(code: string) {
    const sb = await getSupabase();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const totp = (factors?.totp ?? []).find(f => f.status === 'verified');
    if (!totp) return { error: 'Aucun facteur TOTP vérifié.' };
    return verifyTotp(totp.id, code);
  }

  async function unenrollTotp(factorId?: string) {
    const sb = await getSupabase();
    let id = factorId;
    if (!id) {
      const { data: factors } = await sb.auth.mfa.listFactors();
      id = (factors?.totp ?? [])[0]?.id;
    }
    if (!id) return { error: 'Aucun facteur à retirer.' };
    const { error } = await sb.auth.mfa.unenroll({ factorId: id });
    if (!error) await refreshMfa();
    return { error: error?.message };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        roles,
        loading,
        needsMfa,
        hasTotp,
        signIn,
        signInWithLink,
        signOut,
        enrollTotp,
        verifyTotp,
        challengeTotp,
        unenrollTotp,
      }}
    >
      {children}
      <ConfirmDialog
        open={perteADecider !== null}
        destructive
        title={t('sync.signOutPendingTitle')}
        confirmLabel={t('sync.signOutAnyway')}
        onCancel={() => repondrePerte(false)}
        onConfirm={() => repondrePerte(true)}
      >
        {t('sync.signOutPending', { n: perteADecider?.n ?? 0 })}
      </ConfirmDialog>
    </AuthContext.Provider>
  );
}
