import { NavLink } from 'react-router-dom';
import {
  BookOpenText,
  ChartPie,
  LayoutGrid,
  ScrollText,
  Settings,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn.ts';

interface Tab {
  to: string;
  label: string;
  Icon: LucideIcon;
  end: boolean;
}

const tabs: Tab[] = [
  { to: '/', label: 'Bilan', Icon: LayoutGrid, end: true },
  { to: '/journal', label: 'Journal', Icon: ScrollText, end: false },
  { to: '/categories', label: 'Catégories', Icon: BookOpenText, end: false },
  { to: '/synthese', label: 'Synthèse', Icon: ChartPie, end: false },
  { to: '/seasons', label: 'Saisons', Icon: CalendarRange, end: false },
  { to: '/settings', label: 'Réglages', Icon: Settings, end: false },
];

/** Navigation principale mobile : bottom nav, zones tactiles ≥ 44px. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-30 border-t border-[var(--uwh-border)] bg-[var(--uwh-surface)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)] no-print"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold',
                  isActive ? 'text-primary' : 'text-[var(--uwh-text-soft)]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 2}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                  {isActive && <span className="sr-only">(page active)</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
