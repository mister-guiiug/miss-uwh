import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Card } from '../shared/components/Card.tsx';
import { Button } from '../shared/components/Button.tsx';
import { TextField } from '../shared/components/Field.tsx';
import { Badge } from '../shared/components/badges.tsx';
import { useI18n } from '../i18n/index.ts';
import { useAuth, type TotpEnrollment } from './useAuth.ts';

/** Carte d'enrôlement TOTP (Réglages, mode Supabase). */
export function MfaCard() {
  const { hasTotp, enrollTotp, verifyTotp, unenrollTotp } = useAuth();
  const { t } = useI18n();
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(undefined);
    const res = await enrollTotp();
    if ('error' in res) setError(res.error);
    else setEnroll(res);
    setBusy(false);
  }

  async function confirm() {
    if (!enroll) return;
    setBusy(true);
    setError(undefined);
    const { error } = await verifyTotp(enroll.factorId, code.trim());
    if (error) setError(t('mfa.invalid'));
    else {
      setEnroll(null);
      setCode('');
    }
    setBusy(false);
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
          <h3 className="font-display font-bold">{t('mfa.cardTitle')}</h3>
        </div>
        {hasTotp && <Badge tone="credit">{t('mfa.enabled')}</Badge>}
      </div>

      {hasTotp ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('mfa.activeDesc')}
          </p>
          <Button variant="ghost" onClick={() => void unenrollTotp()}>
            <ShieldOff size={16} aria-hidden="true" /> {t('common.disable')}
          </Button>
        </div>
      ) : enroll ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[var(--uwh-text-soft)]">{t('mfa.scan')}</p>
          {/* QR fourni par Supabase (SVG data URL) */}
          <img
            src={enroll.qrCode}
            alt={t('mfa.qrAlt')}
            className="h-40 w-40 rounded-lg bg-white p-1"
          />
          <code className="break-all text-xs text-[var(--uwh-text-soft)]">
            {enroll.secret}
          </code>
          <TextField
            label={t('mfa.codeLabel')}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value)}
            error={error}
          />
          <Button
            block
            disabled={busy || code.trim().length < 6}
            onClick={confirm}
          >
            {t('common.enable')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--uwh-text-soft)]">
            {t('mfa.protect')}
          </p>
          <Button variant="secondary" disabled={busy} onClick={start}>
            {t('common.enable')}
          </Button>
        </div>
      )}
      {error && !enroll && (
        <p role="alert" className="mt-2 text-xs text-[var(--uwh-debit)]">
          {error}
        </p>
      )}
    </Card>
  );
}
