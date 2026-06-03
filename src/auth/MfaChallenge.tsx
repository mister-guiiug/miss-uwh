import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../shared/components/Card.tsx';
import { Button } from '../shared/components/Button.tsx';
import { TextField } from '../shared/components/Field.tsx';
import { useAuth } from './AuthContext.tsx';

/** Étape MFA à la connexion (élévation AAL2) pour les rôles sensibles. */
export function MfaChallenge() {
  const { challengeTotp, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await challengeTotp(code.trim());
    if (error) setError('Code invalide. Réessayez.');
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-5">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck size={28} aria-hidden="true" />
        <span className="font-display text-xl font-bold">
          Double authentification
        </span>
      </div>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--uwh-text-soft)]">
            Saisissez le code à 6 chiffres de votre application
            d'authentification (TOTP).
          </p>
          <TextField
            label="Code TOTP"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value)}
            error={error}
            required
          />
          <Button type="submit" block disabled={busy || code.trim().length < 6}>
            {busy ? 'Vérification…' : 'Valider'}
          </Button>
          <Button variant="ghost" block onClick={() => void signOut()}>
            Se déconnecter
          </Button>
        </form>
      </Card>
    </div>
  );
}
