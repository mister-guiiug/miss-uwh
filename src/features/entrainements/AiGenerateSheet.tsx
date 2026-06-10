import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Sparkles, TriangleAlert } from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  type ExerciseCategory,
} from '../../shared/types/domain.ts';
import { Sheet } from '../../shared/components/Sheet.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { notifySuccess } from '../../shared/lib/toasts.ts';
import {
  generateExercises,
  type GeneratedExercise,
  type GenerateRequest,
} from './aiExercises.ts';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COUNTS = [1, 2, 3, 4, 5, 6, 8, 10];

export function AiGenerateSheet({ open, onClose }: Props) {
  const season = useAppStore(selectActiveSeason);
  const ai = useAppStore(s => s.data.settings.ai);
  const sharedSkills = useAppStore(s => s.data.aiConfig?.sharedSkills);
  const addExercise = useAppStore(s => s.addExercise);

  const [count, setCount] = useState(3);
  const [category, setCategory] = useState<ExerciseCategory | 'any'>('any');
  const [level, setLevel] = useState('');
  const [theme, setTheme] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<GeneratedExercise[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const hasKey = Boolean(ai?.apiKey?.trim());
  const seasonClosed = season.status === 'cloturee';

  function reset() {
    setBusy(false);
    setError(undefined);
    setResults(null);
    setSelected(new Set());
  }

  function close() {
    reset();
    setLevel('');
    setTheme('');
    onClose();
  }

  async function onGenerate() {
    if (!ai) return;
    setBusy(true);
    setError(undefined);
    setResults(null);
    setSelected(new Set());
    const req: GenerateRequest = { count, category, level, theme };
    try {
      const drafts = await generateExercises(req, ai, sharedSkills);
      setResults(drafts);
      // Tout sélectionné par défaut.
      setSelected(new Set(drafts.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Génération impossible.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function saveSelected() {
    if (!results) return;
    let n = 0;
    results.forEach((draft, i) => {
      if (!selected.has(i)) return;
      addExercise({ ...draft, seasonId: season.id });
      n += 1;
    });
    notifySuccess(`${n} exercice(s) ajouté(s) à la bibliothèque.`);
    close();
  }

  const footer = !hasKey ? (
    <Link to="/settings" onClick={close}>
      <Button block>Configurer la génération IA</Button>
    </Link>
  ) : results ? (
    <Button
      block
      onClick={saveSelected}
      disabled={selected.size === 0 || seasonClosed}
    >
      <Check size={18} aria-hidden="true" /> Ajouter {selected.size} exercice(s)
    </Button>
  ) : (
    <Button block onClick={() => void onGenerate()} disabled={busy}>
      <Sparkles size={18} aria-hidden="true" />
      {busy ? 'Génération…' : 'Générer'}
    </Button>
  );

  return (
    <Sheet
      open={open}
      title="Générer des exercices (IA)"
      onClose={close}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        {!hasKey ? (
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--uwh-surface-2)] p-4 text-sm text-[var(--uwh-text-soft)]">
            <Sparkles
              size={18}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary"
            />
            Configurez votre clé API personnelle dans Réglages → Génération IA
            pour proposer des exercices générés par IA. La clé reste sur cet
            appareil.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--uwh-text-soft)]">
              Les exercices proposés sont ajoutés à la saison{' '}
              <strong>{season.label}</strong> après votre validation. Le
              contexte commun du club et vos préférences (Réglages) sont pris en
              compte.
            </p>

            {results === null && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Nombre"
                    value={String(count)}
                    onChange={e => setCount(Number(e.target.value))}
                  >
                    {COUNTS.map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Catégorie"
                    value={category}
                    onChange={e =>
                      setCategory(e.target.value as ExerciseCategory | 'any')
                    }
                  >
                    <option value="any">Variées</option>
                    {EXERCISE_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {EXERCISE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <TextField
                  label="Niveau / public (optionnel)"
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  placeholder="Ex. Débutants, N1, jeunes"
                />
                <TextField
                  label="Thème / objectif (optionnel)"
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  placeholder="Ex. Travail de la passe en infériorité"
                />
              </>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 text-sm text-[var(--uwh-debit)]"
              >
                <TriangleAlert
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 break-words">{error}</span>
              </p>
            )}

            {results && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">
                  {results.length} proposition(s) — cochez celles à conserver :
                </p>
                {seasonClosed && (
                  <p className="text-xs text-[var(--uwh-warn)]">
                    Saison {season.label} clôturée — rouvrez-la pour ajouter.
                  </p>
                )}
                <ul className="flex flex-col gap-2">
                  {results.map((ex, i) => {
                    const on = selected.has(i);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => toggle(i)}
                          aria-pressed={on}
                          className={
                            'flex w-full items-start gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] ' +
                            (on
                              ? 'border-primary bg-[var(--color-primary-soft)]'
                              : 'border-[var(--uwh-border)] bg-[var(--uwh-surface)]')
                          }
                        >
                          <span
                            aria-hidden="true"
                            className={
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ' +
                              (on
                                ? 'border-primary bg-primary text-white'
                                : 'border-[var(--uwh-border)]')
                            }
                          >
                            {on && <Check size={14} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                              {ex.name}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--uwh-text-soft)]">
                              <span className="rounded-full bg-[var(--uwh-surface-2)] px-2 py-0.5 font-semibold text-primary">
                                {EXERCISE_CATEGORY_LABELS[ex.category]}
                              </span>
                              {ex.durationMin != null && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={11} aria-hidden="true" />
                                  {ex.durationMin} min
                                </span>
                              )}
                              {ex.level && <span>{ex.level}</span>}
                            </span>
                            {ex.description && (
                              <span className="mt-1 block whitespace-pre-wrap text-xs text-[var(--uwh-text-soft)]">
                                {ex.description}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 self-start text-sm font-semibold text-primary"
                >
                  ↻ Régénérer
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
