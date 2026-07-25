import { useState, type FormEvent } from 'react';
import { Waves } from 'lucide-react';
import { Card } from '../shared/components/Card.tsx';
import { Button } from '../shared/components/Button.tsx';
import { TextField } from '../shared/components/Field.tsx';
import { useI18n } from '../i18n/index.ts';
import { useAuth } from './useAuth.ts';

/** Écran de connexion (mode Supabase). MFA gérée par Supabase Auth. */
export function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await signIn(email, password);
    if (error) setError(t('auth.invalidCredentials'));
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-5">
      <div className="flex items-center gap-2 text-primary">
        <Waves size={28} aria-hidden="true" />
        <span className="font-display text-2xl font-bold">Miss UWH</span>
      </div>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <h1 className="font-display text-lg font-bold">{t('auth.title')}</h1>
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={error}
          />
          <Button type="submit" block disabled={busy}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
          <p className="text-center text-xs text-[var(--uwh-text-soft)]">
            {t('auth.mfaNote')}
          </p>
        </form>
      </Card>
    </div>
  );
}
