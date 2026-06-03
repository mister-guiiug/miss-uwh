import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Download,
  FileSpreadsheet,
  LogOut,
  Printer,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { BACKEND, IS_SUPABASE } from '../../backend/config.ts';
import { useAuth } from '../../auth/AuthContext.tsx';
import { MfaCard } from '../../auth/MfaCard.tsx';
import { MembersSheet } from '../admin/MembersSheet.tsx';
import { importData } from '../../shared/lib/storage.ts';
import {
  exportBilanCsv,
  exportJournalCsv,
  exportJsonBackup,
} from '../export/exporters.ts';
import { ImportSheet } from '../import/ImportSheet.tsx';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';
import { Badge } from '../../shared/components/badges.tsx';

export function SettingsScreen() {
  const club = useAppStore(s => s.data.club);
  const data = useAppStore(s => s.data);
  const season = useAppStore(selectActiveSeason);
  const showCompensated = useAppStore(s => s.data.settings.showCompensated);
  const updateClub = useAppStore(s => s.updateClub);
  const updateSettings = useAppStore(s => s.updateSettings);
  const replaceData = useAppStore(s => s.replaceData);
  const resetAll = useAppStore(s => s.resetAll);

  const { roles, signOut } = useAuth();
  const isAdmin = roles.includes('admin_technique');
  const [importing, setImporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreError, setRestoreError] = useState<string>();
  const [members, setMembers] = useState(false);

  async function onRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      replaceData(importData(text));
      setRestoreError(undefined);
    } catch {
      setRestoreError('Fichier de sauvegarde invalide.');
    }
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Club */}
      <Card>
        <h3 className="mb-3 font-display font-bold">Club</h3>
        <div className="flex flex-col gap-3">
          <TextField
            label="Nom du club"
            value={club.name}
            onChange={e => updateClub({ name: e.target.value })}
          />
          <TextField
            label="Trésorier·ère"
            value={club.treasurer ?? ''}
            onChange={e => updateClub({ treasurer: e.target.value })}
          />
          <TextField
            label="Affiliation"
            value={club.ffessmAffiliation ?? ''}
            onChange={e => updateClub({ ffessmAffiliation: e.target.value })}
          />
        </div>
      </Card>

      {/* Affichage */}
      <Card>
        <h3 className="mb-2 font-display font-bold">Affichage</h3>
        <label className="flex items-center justify-between gap-2 py-1 text-sm">
          Afficher les écritures compensées
          <input
            type="checkbox"
            checked={showCompensated}
            onChange={e =>
              updateSettings({ showCompensated: e.target.checked })
            }
          />
        </label>
      </Card>

      {/* Backend */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Database size={16} className="text-primary" aria-hidden="true" />
          <h3 className="font-display font-bold">Stockage & sécurité</h3>
        </div>
        <p className="flex items-center gap-2 text-sm text-[var(--uwh-text-soft)]">
          Mode actuel :{' '}
          {BACKEND === 'supabase' ? (
            <Badge tone="credit">Supabase (multi-utilisateurs, RBAC)</Badge>
          ) : (
            <Badge tone="neutral">Local (cet appareil)</Badge>
          )}
        </p>
        <p className="mt-2 text-xs text-[var(--uwh-text-soft)]">
          Le mode Supabase active l'authentification, le contrôle d'accès par
          rôle côté serveur (RLS), la MFA pour les rôles sensibles, l'audit
          serveur et le stockage chiffré des justificatifs. Voir le README pour
          la configuration.
        </p>
        <Link to="/audit" className="mt-3 inline-block">
          <Button variant="secondary">
            <ShieldCheck size={16} aria-hidden="true" /> Journal d'audit
          </Button>
        </Link>
      </Card>

      {/* Compte & sécurité (mode Supabase) */}
      {IS_SUPABASE && (
        <>
          <MfaCard />
          <Card>
            <h3 className="mb-3 font-display font-bold">Compte</h3>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Button variant="secondary" onClick={() => setMembers(true)}>
                  <Users size={16} aria-hidden="true" /> Membres & rôles
                </Button>
              )}
              <Button variant="ghost" onClick={() => void signOut()}>
                <LogOut size={16} aria-hidden="true" /> Se déconnecter
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* Exports */}
      <Card>
        <h3 className="mb-3 font-display font-bold">Export</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => exportJournalCsv(season, data.entries)}
          >
            <Download size={16} aria-hidden="true" /> Journal CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportBilanCsv(season, data.entries)}
          >
            <Download size={16} aria-hidden="true" /> Bilan CSV
          </Button>
          <Button variant="secondary" onClick={() => exportJsonBackup(data)}>
            <Download size={16} aria-hidden="true" /> Sauvegarde JSON
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Bilan PDF
          </Button>
        </div>
      </Card>

      {/* Imports */}
      <Card>
        <h3 className="mb-3 font-display font-bold">Import & migration</h3>
        <div className="flex flex-col gap-2">
          <Button onClick={() => setImporting(true)}>
            <FileSpreadsheet size={16} aria-hidden="true" /> Importer un Excel
            (.xlsx)
          </Button>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] px-5 py-2.5 text-[15px] font-semibold">
            <Upload size={16} aria-hidden="true" /> Restaurer une sauvegarde
            JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onRestore}
            />
          </label>
          {restoreError && (
            <p role="alert" className="text-xs text-[var(--uwh-debit)]">
              {restoreError}
            </p>
          )}
        </div>
      </Card>

      {/* Danger */}
      <Card className="border-[var(--uwh-debit)]/30">
        <h3 className="mb-2 font-display font-bold text-[var(--uwh-debit)]">
          Zone sensible
        </h3>
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          <Trash2 size={16} aria-hidden="true" /> Tout réinitialiser
        </Button>
      </Card>

      <p className="text-center text-xs text-[var(--uwh-text-soft)]">
        Miss UWH v{__APP_VERSION__}
      </p>

      <ImportSheet open={importing} onClose={() => setImporting(false)} />
      <MembersSheet open={members} onClose={() => setMembers(false)} />
      <ConfirmDialog
        open={confirmReset}
        title="Tout réinitialiser ?"
        danger
        confirmLabel="Réinitialiser"
        onClose={() => setConfirmReset(false)}
        onConfirm={() =>
          resetAll(club.name, season.label, season.openingBalance)
        }
      >
        Toutes les écritures, saisons et l'audit local seront effacés sur cet
        appareil. Pensez à exporter une sauvegarde JSON avant.
      </ConfirmDialog>
    </div>
  );
}
