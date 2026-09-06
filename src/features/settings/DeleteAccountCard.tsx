import { useState } from 'react';
import { UserX } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { useAuth } from '../../auth/useAuth.ts';
import { useI18n } from '../../i18n/index.ts';
import { useAppStore } from '../../store/useAppStore.ts';
import { notifyError, notifySuccess } from '../../shared/lib/toasts.ts';
import { DeleteAccountError, deleteMyAccount } from '../../backend/account.ts';

/**
 * Supprimer son compte — le droit à l'effacement, sans écrire au mainteneur.
 *
 * OÙ ELLE VIT. Dans la « Zone sensible » des réglages, à côté de « Tout
 * réinitialiser ». Les deux boutons se ressemblent et ne font pas du tout la
 * même chose — d'où deux précautions : le texte dit lequel est LOCAL et lequel
 * est DÉFINITIF, et celui-ci exige un geste que l'autre n'exige pas.
 *
 * LE GESTE DÉLIBÉRÉ. Retaper le nom du club, pas cliquer « OK ». Un « êtes-vous
 * sûr ? » se confirme par réflexe : c'est le geste que l'on fait dix fois par
 * jour pour fermer une boîte. Recopier un nom oblige à lire la boîte, et ne
 * peut pas être fait par mégarde ni par un double-clic parti trop vite.
 *
 * LE BOUTON DE CONFIRMATION N'EST PAS DÉSACTIVÉ, IL RÉPOND. Le `ConfirmDialog`
 * du socle n'a pas d'état « inerte tant que… » — seulement `loading`, qui pose
 * `aria-busy` et raconterait donc une attente là où il n'y en a pas. Un bouton
 * qu'on presse et qui ne fait RIEN, sans dire pourquoi, est le pire des deux
 * mondes : ici il dit pourquoi, dans le message d'erreur du champ
 * (`role="alert"`, annoncé par un lecteur d'écran).
 *
 * HORS LIGNE, ON NE DEMANDE PAS. Le garde du socle bloque l'ouverture : poser
 * « êtes-vous sûr ? » pour une suppression qui ne peut pas avoir lieu, puis
 * échouer, laisse la personne sans savoir si son compte a été touché. Même
 * raison que la `PrivacyCard` de mister-doc.
 *
 * MODE LOCAL : cette carte n'est pas rendue du tout (cf. `SettingsScreen`).
 * Sans backend, l'app est entière et il n'y a aucun compte à supprimer ; « Tout
 * réinitialiser », lui, reste et suffit.
 */
export function DeleteAccountCard({ clubName }: { clubName: string }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const wipeLocal = useAppStore(s => s.wipeLocal);

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);

  const guard = useActionGuard({
    online: true,
    offlineMessage: t('settings.deleteAccountOffline'),
  });

  function close() {
    setOpen(false);
    setTyped('');
    setMismatch(false);
  }

  async function confirm() {
    // La comparaison ignore les espaces de bord et la casse : on demande une
    // intention, pas une dictée. Le nom lui-même reste à recopier.
    const expected = clubName.trim().toLocaleLowerCase();
    if (typed.trim().toLocaleLowerCase() !== expected) {
      setMismatch(true);
      return;
    }
    setBusy(true);
    try {
      const outcome = await deleteMyAccount();
      // L'ORDRE COMPTE. On purge le miroir AVANT de déconnecter : la
      // déconnexion le fait déjà (`SIGNED_OUT` → `wipeLocal`, AuthContext),
      // mais elle passe par le réseau et peut échouer — et l'appareil, lui,
      // peut être celui du club. Purger deux fois ne coûte rien ; ne pas
      // purger laisserait la comptabilité en clair sur un appareil dont le
      // compte n'existe plus.
      wipeLocal();
      close();
      notifySuccess(
        outcome === 'anonymise'
          ? t('settings.deleteAccountAnonymised')
          : t('settings.deleteAccountDone')
      );
      await signOut();
    } catch (e) {
      // Le serveur refuse pour une raison qui se lit : dernier administrateur
      // du club. Son message est en français et destiné à l'utilisateur.
      const refusal = e instanceof DeleteAccountError && e.code === '42501';
      notifyError(
        refusal && e.message
          ? t('settings.deleteAccountRefused', { reason: e.message })
          : t('settings.deleteAccountFailed')
      );
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button
          variant="danger"
          className="self-start"
          {...guard.disabledProps}
          title={guard.reason ?? undefined}
          onClick={guard.wrap(() => setOpen(true))}
        >
          <UserX size={16} aria-hidden="true" /> {t('settings.deleteAccount')}
        </Button>
        <p className="text-xs text-[var(--uwh-text-soft)]">
          {t('settings.deleteAccountDesc')}
        </p>
        {guard.reason && (
          <p role="status" className="text-xs text-[var(--uwh-debit)]">
            {guard.reason}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={open}
        destructive
        loading={busy}
        title={t('settings.deleteAccountConfirmTitle')}
        confirmLabel={t('settings.deleteAccount')}
        onCancel={close}
        onConfirm={() => void confirm()}
      >
        <div className="flex flex-col gap-3">
          <p>{t('settings.deleteAccountConfirmBody')}</p>
          <TextField
            label={t('settings.deleteAccountType', { club: clubName })}
            value={typed}
            autoComplete="off"
            onChange={e => {
              setTyped(e.target.value);
              setMismatch(false);
            }}
            {...(mismatch
              ? { error: t('settings.deleteAccountMismatch') }
              : {})}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
