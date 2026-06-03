import { useState, type FormEvent } from 'react';
import { Waves } from 'lucide-react';
import { Card } from '../shared/components/Card.tsx';
import { Button } from '../shared/components/Button.tsx';
import { TextField } from '../shared/components/Field.tsx';
import { useAuth } from './AuthContext.tsx';

/** Écran de connexion (mode Supabase). MFA gérée par Supabase Auth. */
export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await signIn(email, password);
    if (error) setError('Identifiants invalides.');
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
          <h1 className="font-display text-lg font-bold">Connexion</h1>
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={error}
          />
          <Button type="submit" block disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </Button>
          <p className="text-center text-xs text-[var(--uwh-text-soft)]">
            Une vérification MFA (TOTP) peut être demandée pour les rôles
            sensibles (trésorier, président, administrateur).
          </p>
        </form>
      </Card>
    </div>
  );
}
