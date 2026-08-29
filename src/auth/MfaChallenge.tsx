import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../shared/components/Card.tsx';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { TextField } from '@mister-guiiug/dev-wpa-config/react/field';
import { useI18n } from '../i18n/index.ts';
import { useAuth } from './useAuth.ts';

/** Étape MFA à la connexion (élévation AAL2) pour les rôles sensibles. */
export function MfaChallenge() {
  const { challengeTotp, signOut } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await challengeTotp(code.trim());
    if (error) setError(t('mfa.invalidRetry'));
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-5">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck size={28} aria-hidden="true" />
        <span className="font-display text-xl font-bold">
          {t('mfa.challengeTitle')}
        </span>
      </div>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('mfa.enterCode')}
          </p>
          <TextField
            label={t('mfa.codeLabel')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value)}
            error={error}
            required
          />
          <Button type="submit" block disabled={busy || code.trim().length < 6}>
            {busy ? t('mfa.verifying') : t('mfa.verify')}
          </Button>
          <Button variant="ghost" block onClick={() => void signOut()}>
            {t('common.signOut')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
