import { useState, type FormEvent } from 'react';
import { Waves } from 'lucide-react';
import { Card } from '@mister-guiiug/dev-pwa-config/react/card';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
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
      <div className="flex items-center gap-2 text-primary">
        <Waves size={28} aria-hidden="true" />
        <span className="font-display text-2xl font-bold">Miss UWH</span>
      </div>
      <Card className="w-full">
        {sentTo ? (
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-lg font-bold">
              {t('auth.linkSentTitle')}
            </h1>
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
            <h1 className="font-display text-lg font-bold">
              {t('auth.title')}
            </h1>
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
