import { useState, type FormEvent } from 'react';
import { Waves } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { TextField } from '../../shared/components/Field.tsx';

/** Première installation : nom du club, saison de départ, reliquat d'ouverture. */
export function Onboarding() {
  const setupClub = useAppStore(s => s.setupClub);
  const club = useAppStore(s => s.data.club);
  const season = useAppStore(s =>
    s.data.seasons.find(x => x.id === s.data.activeSeasonId)
  );
  const [name, setName] = useState(club.name);
  const [label, setLabel] = useState(season?.label ?? '2025-2026');
  const [opening, setOpening] = useState(String(season?.openingBalance ?? 0));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setupClub(
      { ...club, name: name.trim() || 'Mon club' },
      label.trim() || '2025-2026',
      Number(opening.replace(',', '.')) || 0
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex rounded-2xl bg-[var(--color-primary-soft)] p-3 text-primary">
          <Waves size={30} aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold">Miss UWH</h1>
        <p className="mt-1 text-sm text-[var(--uwh-text-soft)]">
          Le bilan comptable de votre club de Hockey Subaquatique, saison après
          saison.
        </p>
      </div>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField
            label="Nom du club"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Clermont Hockey Sub"
            required
          />
          <TextField
            label="Saison de départ"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="2025-2026"
            required
          />
          <TextField
            label="Reliquat d'ouverture (€)"
            inputMode="decimal"
            value={opening}
            onChange={e => setOpening(e.target.value)}
            hint="Solde reporté de l'exercice précédent."
          />
          <Button type="submit" block>
            Commencer
          </Button>
        </form>
      </Card>
      <p className="text-center text-xs text-[var(--uwh-text-soft)]">
        Données stockées localement sur cet appareil. Vous pourrez activer un
        compte sécurisé (Supabase) plus tard dans les réglages.
      </p>
    </div>
  );
}
