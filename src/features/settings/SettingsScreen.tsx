import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  LogOut,
  Plug,
  Printer,
  Repeat,
  RotateCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore, selectActiveSeason } from '../../store/useAppStore.ts';
import { IS_SUPABASE } from '../../backend/config.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { MfaCard } from '../../auth/MfaCard.tsx';
import { importData } from '../../shared/lib/storage.ts';
import {
  exportBilanCsv,
  exportJournalCsv,
  exportJsonBackup,
} from '../export/exporters.ts';
import { exportWorkbookXlsx } from '../export/xlsxExport.ts';
import { ImportSheet } from '../import/ImportSheet.tsx';
import { RecurringSheet } from '../recurring/RecurringSheet.tsx';
import { AdherentsSheet } from '../adherents/AdherentsSheet.tsx';
import { DatabaseStatusCard } from './DatabaseStatusCard.tsx';
import { AiSkillsCard } from './AiSkillsCard.tsx';
import { forceUpdate } from '../../pwa/forceUpdate.ts';
import { Card } from '../../shared/components/Card.tsx';
import { Button } from '../../shared/components/Button.tsx';
import { SelectField, TextField } from '../../shared/components/Field.tsx';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.tsx';
import { AppFooter } from '../../shared/components/AppFooter.tsx';
import { cn } from '../../shared/lib/cn.ts';

/** Minuscule + sans accents, pour une recherche tolérante. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Mesure la hauteur de l'en-tête global collant (AppHeader + bandeau de synchro,
 * cf. Shell dans App.tsx) et en déduit où parquer la nav et où aligner les
 * ancres de section. Re-mesuré au resize et quand le bandeau apparaît/disparaît.
 */
function useStickyOffsets(navRef: RefObject<HTMLElement | null>) {
  const [headerTop, setHeaderTop] = useState(0);
  const [offset, setOffset] = useState(128);
  useEffect(() => {
    const wrap = document.querySelector('header')?.parentElement ?? null;
    const measure = () => {
      const h = wrap?.getBoundingClientRect().height ?? 0;
      const n = navRef.current?.getBoundingClientRect().height ?? 0;
      setHeaderTop(h);
      setOffset(Math.round(h + n + 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap) ro.observe(wrap);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [navRef]);
  return { headerTop, offset };
}

interface SectionDef {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Mots-clés (en plus du libellé) pour la recherche. */
  keywords: string;
  node: ReactNode;
}

function Section({
  id,
  label,
  Icon,
  offset,
  children,
}: {
  id: string;
  label: string;
  Icon: LucideIcon;
  offset: number;
  children: ReactNode;
}) {
  return (
    <section
      id={`set-${id}`}
      aria-label={label}
      style={{ scrollMarginTop: offset }}
      className="flex flex-col gap-3"
    >
      <h2 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-[var(--uwh-text-soft)]">
        <Icon size={14} aria-hidden="true" />
        {label}
      </h2>
      {children}
    </section>
  );
}

export function SettingsScreen() {
  const club = useAppStore(s => s.data.club);
  const data = useAppStore(s => s.data);
  const season = useAppStore(selectActiveSeason);
  const theme = useAppStore(s => s.data.settings.theme);
  const decimals = useAppStore(s => s.data.settings.decimals);
  const showCompensated = useAppStore(s => s.data.settings.showCompensated);
  const helloAsso = useAppStore(s => s.data.settings.helloAsso);
  const googleCalendar = useAppStore(s => s.data.settings.googleCalendar);
  const setTheme = useAppStore(s => s.setTheme);
  const updateClub = useAppStore(s => s.updateClub);
  const updateSettings = useAppStore(s => s.updateSettings);
  const replaceData = useAppStore(s => s.replaceData);
  const resetAll = useAppStore(s => s.resetAll);

  const { roles, signOut } = useAuth();
  const isAdmin = roles.includes('admin_technique');

  const [importing, setImporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreError, setRestoreError] = useState<string>();
  const [recurring, setRecurring] = useState(false);
  const [adherents, setAdherents] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [query, setQuery] = useState('');

  const navRef = useRef<HTMLElement>(null);
  const { headerTop, offset } = useStickyOffsets(navRef);
  const [activeId, setActiveId] = useState<string>('club');

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

  const sections: SectionDef[] = [
    {
      id: 'club',
      label: 'Club',
      Icon: Building2,
      keywords: 'club nom tresorier affiliation ffessm identite',
      node: (
        <Card>
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
      ),
    },
    {
      id: 'affichage',
      label: 'Affichage',
      Icon: SlidersHorizontal,
      keywords: 'affichage theme clair sombre decimales compensees ecritures',
      node: (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Thème"
                value={theme}
                onChange={e => setTheme(e.target.value as 'light' | 'dark')}
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
              </SelectField>
              <SelectField
                label="Décimales affichées"
                value={String(decimals)}
                onChange={e =>
                  updateSettings({ decimals: Number(e.target.value) })
                }
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </SelectField>
            </div>
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
          </div>
        </Card>
      ),
    },
    {
      id: 'donnees',
      label: 'Données',
      Icon: Database,
      keywords:
        'donnees base synchronisation export import excel csv json sauvegarde restaurer migration recurrents adherents pdf bilan classeur',
      node: (
        <>
          <DatabaseStatusCard />
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
              <Button
                variant="secondary"
                onClick={() => exportJsonBackup(data)}
              >
                <Download size={16} aria-hidden="true" /> Sauvegarde JSON
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={16} aria-hidden="true" /> Bilan PDF
              </Button>
              <Button
                variant="secondary"
                className="col-span-2"
                onClick={() => void exportWorkbookXlsx(data, season)}
              >
                <FileSpreadsheet size={16} aria-hidden="true" /> Classeur Excel
                multi-feuilles (.xlsx)
              </Button>
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 font-display font-bold">Import & migration</h3>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setImporting(true)}>
                <FileSpreadsheet size={16} aria-hidden="true" /> Importer un
                Excel (.xlsx)
              </Button>
              <Button variant="secondary" onClick={() => setRecurring(true)}>
                <Repeat size={16} aria-hidden="true" /> Modèles récurrents
              </Button>
              <Button variant="secondary" onClick={() => setAdherents(true)}>
                <Users size={16} aria-hidden="true" /> Registre des adhérents
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
        </>
      ),
    },
    {
      id: 'integrations',
      label: 'Intégrations',
      Icon: Plug,
      keywords:
        'integrations helloasso google agenda ical ia generation exercices openai claude cotisations',
      node: (
        <>
          {IS_SUPABASE && (
            <>
              <Card>
                <div className="mb-1 flex items-center gap-2">
                  <Plug size={16} className="text-primary" aria-hidden="true" />
                  <h3 className="font-display font-bold">
                    Intégration HelloAsso
                  </h3>
                </div>
                <p className="mb-3 text-xs text-[var(--uwh-text-soft)]">
                  Organisation et formulaire d'adhésion (les deux derniers
                  segments de l'URL HelloAsso :{' '}
                  <code>
                    helloasso.com/associations/&lt;organisation&gt;/adhesions/&lt;formulaire&gt;
                  </code>
                  ). Sert à l'import des adhésions dans l'onglet Cotisations. La
                  clé API confidentielle reste côté serveur (secrets de l'Edge
                  Function), jamais saisie ici.
                </p>
                <div className="flex flex-col gap-3">
                  <TextField
                    label="Organisation (slug)"
                    placeholder="mon-club"
                    value={helloAsso?.orgSlug ?? ''}
                    onChange={e =>
                      updateSettings({
                        helloAsso: { ...helloAsso, orgSlug: e.target.value },
                      })
                    }
                  />
                  <TextField
                    label="Formulaire d'adhésion (slug)"
                    placeholder="adhesion-2025-2026"
                    value={helloAsso?.formSlug ?? ''}
                    onChange={e =>
                      updateSettings({
                        helloAsso: { ...helloAsso, formSlug: e.target.value },
                      })
                    }
                  />
                  <TextField
                    label="Type de formulaire"
                    hint="Optionnel — « Membership » par défaut (formulaire d'adhésion)."
                    placeholder="Membership"
                    value={helloAsso?.formType ?? ''}
                    onChange={e =>
                      updateSettings({
                        helloAsso: { ...helloAsso, formType: e.target.value },
                      })
                    }
                  />
                </div>
              </Card>

              <Card>
                <div className="mb-1 flex items-center gap-2">
                  <CalendarDays
                    size={16}
                    className="text-primary"
                    aria-hidden="true"
                  />
                  <h3 className="font-display font-bold">
                    Intégration Google Agenda
                  </h3>
                </div>
                <p className="mb-3 text-xs text-[var(--uwh-text-soft)]">
                  Adresse iCal publique d'un calendrier Google, pour importer
                  ses événements dans Vie du club → Événements. Dans Google
                  Agenda :{' '}
                  <em>
                    Paramètres du calendrier → Intégrer le calendrier → Adresse
                    publique au format iCal
                  </em>{' '}
                  (le calendrier doit être public).
                </p>
                <TextField
                  label="URL iCal (.ics)"
                  type="url"
                  inputMode="url"
                  placeholder="https://calendar.google.com/calendar/ical/…/public/basic.ics"
                  value={googleCalendar?.icsUrl ?? ''}
                  onChange={e =>
                    updateSettings({
                      googleCalendar: {
                        ...googleCalendar,
                        icsUrl: e.target.value,
                      },
                    })
                  }
                />
              </Card>
            </>
          )}
          <AiSkillsCard />
        </>
      ),
    },
    {
      id: 'securite',
      label: 'Sécurité',
      Icon: ShieldCheck,
      keywords:
        'securite mfa audit roles membres deconnexion rls authentification compte',
      node: (
        <>
          <Card>
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck
                size={16}
                className="text-primary"
                aria-hidden="true"
              />
              <h3 className="font-display font-bold">Sécurité & accès</h3>
            </div>
            <p className="text-xs text-[var(--uwh-text-soft)]">
              Le mode Supabase active l'authentification, le contrôle d'accès
              par rôle côté serveur (RLS), la MFA pour les rôles sensibles,
              l'audit serveur et le stockage chiffré des justificatifs. Voir le
              README pour la configuration.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/audit">
                <Button variant="secondary">
                  <ShieldCheck size={16} aria-hidden="true" /> Journal d'audit
                </Button>
              </Link>
              {IS_SUPABASE && isAdmin && (
                <Link to="/members">
                  <Button variant="secondary">
                    <Users size={16} aria-hidden="true" /> Membres & rôles
                  </Button>
                </Link>
              )}
            </div>
          </Card>
          {IS_SUPABASE && <MfaCard />}
          {IS_SUPABASE && (
            <Button variant="secondary" block onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> Se déconnecter
            </Button>
          )}
        </>
      ),
    },
    {
      id: 'avance',
      label: 'Avancé',
      Icon: Settings2,
      keywords:
        'avance application version mise a jour reinitialiser zone sensible cache',
      node: (
        <>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold">Application</h3>
                <p className="text-xs text-[var(--uwh-text-soft)]">
                  Miss UWH v{__APP_VERSION__}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void forceUpdate()}>
                <RotateCw size={16} aria-hidden="true" /> Forcer la mise à jour
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--uwh-text-soft)]">
              Récupère la dernière version (vide les caches et recharge). Vos
              données locales ne sont pas effacées.
            </p>
          </Card>

          <Card className="border-[var(--uwh-debit)]/30">
            <button
              type="button"
              onClick={() => setShowDanger(v => !v)}
              aria-expanded={showDanger}
              className="flex w-full items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 font-display font-bold text-[var(--uwh-debit)]">
                <AlertTriangle size={16} aria-hidden="true" /> Zone sensible
              </span>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={cn(
                  'text-[var(--uwh-text-soft)] transition-transform',
                  showDanger && 'rotate-180'
                )}
              />
            </button>
            {showDanger && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-xs text-[var(--uwh-text-soft)]">
                  Efface toutes les écritures, saisons et l'audit local sur cet
                  appareil. Exportez une sauvegarde JSON au préalable.
                </p>
                <Button
                  variant="danger"
                  className="self-start"
                  onClick={() => setConfirmReset(true)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Tout réinitialiser
                </Button>
              </div>
            )}
          </Card>
        </>
      ),
    },
  ];

  const q = norm(query.trim());
  const visible = q
    ? sections.filter(s => norm(`${s.label} ${s.keywords}`).includes(q))
    : sections;
  const visibleIds = useMemo(() => visible.map(s => s.id).join(','), [visible]);

  // Scroll-spy : la section active est la dernière dont le haut a franchi la
  // ligne sous la nav. rAF pour ne pas marteler le thread au défilement.
  useEffect(() => {
    if (q) return; // pas de nav pendant une recherche
    const ids = visibleIds.split(',').filter(Boolean);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let current = ids[0];
        for (const id of ids) {
          const el = document.getElementById(`set-${id}`);
          if (el && el.getBoundingClientRect().top <= offset + 4) current = id;
        }
        if (current) setActiveId(current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [q, visibleIds, offset]);

  function jumpTo(id: string) {
    setActiveId(id);
    document
      .getElementById(`set-${id}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="flex flex-col">
      {/* Recherche */}
      <div className="px-4 pb-2 pt-4">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--uwh-text-soft)]"
          />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un réglage…"
            aria-label="Rechercher un réglage"
            className="min-h-11 w-full rounded-2xl border border-[var(--uwh-border)] bg-[var(--uwh-surface-2)] pl-11 pr-4 text-[16px] focus:border-primary"
          />
        </div>
      </div>

      {/* Nav rapide collante (masquée pendant une recherche) */}
      {!q && (
        <nav
          ref={navRef}
          aria-label="Sections des réglages"
          style={{ top: headerTop }}
          className="no-print sticky z-20 border-b border-[var(--uwh-border)] bg-[var(--uwh-surface)]/95 backdrop-blur"
        >
          <div className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map(s => {
              const active = s.id === activeId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(s.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-primary text-white'
                      : 'bg-[var(--uwh-surface-2)] text-[var(--uwh-text-soft)]'
                  )}
                >
                  <s.Icon size={14} aria-hidden="true" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-6 p-4">
        {visible.map(s => (
          <Section
            key={s.id}
            id={s.id}
            label={s.label}
            Icon={s.Icon}
            offset={offset}
          >
            {s.node}
          </Section>
        ))}
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--uwh-text-soft)]">
            Aucun réglage ne correspond à « {query.trim()} ».
          </p>
        )}
        <AppFooter />
      </div>

      <ImportSheet open={importing} onClose={() => setImporting(false)} />
      <RecurringSheet open={recurring} onClose={() => setRecurring(false)} />
      <AdherentsSheet open={adherents} onClose={() => setAdherents(false)} />
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
