import { useState, type FormEvent } from 'react';
import { Waves } from 'lucide-react';
import { Card } from '@mister-guiiug/dev-pwa-config/react/card';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { usePageViews } from '@mister-guiiug/dev-pwa-config/react/use-page-views';
import { useI18n } from '../i18n/index.ts';
import { useAuth } from './useAuth.ts';

type Mode = 'link' | 'password';

/**
 * Écran de connexion (mode Supabase). MFA gérée par Supabase Auth.
 *
 * LE LIEN D'ABORD, LE MOT DE PASSE EN OPTION. Un lien à usage unique arrive
 * dans la boîte : rien à retenir, rien à voler, rien à réinitialiser. Le
 * formulaire par mot de passe reste à un clic, pour qui y tient — c'est la
 * règle de la famille depuis l'étape 5 d'AMELIORATIONS.md. La vérification
 * MFA, elle, intervient APRÈS la session, quel que soit le chemin.
 */
export function LoginPage() {
  /*
   * L'ÉCRAN DE CONNEXION EST UNE VUE DE PAGE, et c'est ici qu'elle se déclare.
   *
   * `usePageViews` vit dans `Inner`, derrière `AuthGate` : hors session, le
   * routeur n'est pas monté et le hook ne s'exécute jamais. Mesuré en
   * production le 16/09/2026, socle 4.20.0 en place : consentement accordé,
   * bandeau parti, ZÉRO vue. Sur une app à connexion, c'est l'essentiel du
   * trafic qui ne comptait pas.
   *
   * La vue est déclarée par l'écran plutôt que par une condition posée
   * au-dessus de la porte : une condition dupliquée finit par diverger de la
   * porte qu'elle imite.
   */
  usePageViews('/connexion');
  const { signIn, signInWithLink } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    if (mode === 'link') {
      const { error } = await signInWithLink(email.trim());
      if (error) setError(t('auth.linkFailed'));
      else setSentTo(email.trim());
      setBusy(false);
      return;
    }
    const { error } = await signIn(email, password);
    if (error) setError(t('auth.invalidCredentials'));
    setBusy(false);
  }

  function switchMode() {
    setMode(m => (m === 'link' ? 'password' : 'link'));
    setError(undefined);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-5">
      {/* LE NOM DE L'APP EST LE TITRE DE LA PAGE, et ce qu'on y fait le suit.
          C'est le premier écran de tout visiteur, et le seul que voit un
          moteur : relevé du 23/09/2026, son h1 était « Connexion », et rien
          ne disait ce qu'était l'app. Le formulaire garde son titre, un cran
          plus bas. */}
      <header className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-primary">
          <Waves size={28} aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold">Miss UWH</h1>
        </div>
        <p className="text-sm text-[var(--uwh-text-soft)]">
          {t('auth.tagline')}
        </p>
      </header>
      <Card className="w-full">
        {sentTo ? (
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold">
              {t('auth.linkSentTitle')}
            </h2>
            <p role="status" className="text-sm">
              {t('auth.linkSent', { email: sentTo })}
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSentTo(null)}
            >
              {t('auth.linkAgain')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold">
              {t('auth.title')}
            </h2>
            <TextField
              label={t('auth.email')}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={mode === 'link' ? error : undefined}
            />
            {mode === 'password' && (
              <TextField
                label={t('auth.password')}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                error={error}
              />
            )}
            <Button type="submit" block disabled={busy}>
              {busy
                ? t('auth.signingIn')
                : mode === 'link'
                  ? t('auth.sendLink')
                  : t('auth.signIn')}
            </Button>
            {mode === 'link' && (
              <p className="text-center text-xs text-[var(--uwh-text-soft)]">
                {t('auth.linkIntro')}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={switchMode}
            >
              {mode === 'link' ? t('auth.usePassword') : t('auth.useLink')}
            </Button>
            <p className="text-center text-xs text-[var(--uwh-text-soft)]">
              {t('auth.mfaNote')}
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
