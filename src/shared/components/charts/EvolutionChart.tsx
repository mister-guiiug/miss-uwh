import { formatEuro } from '../../lib/format.ts';

export interface EvolutionPoint {
  label: string;
  recettes: number;
  depenses: number;
  solde: number;
}

const C_REC = '#2f5b8f';
const C_DEP = '#f2c811';
const C_SOLDE = '#1f9d55';

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/** Barres recettes/dépenses + ligne solde créditeur par saison (SVG pur). */
export function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-[var(--uwh-text-soft)]">
        Pas encore d'historique multi-saisons.
      </p>
    );
  }

  const W = 620;
  const H = 340;
  const padL = 48;
  const padR = 10;
  const padT = 14;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = niceMax(
    Math.max(...data.flatMap(d => [d.recettes, d.depenses, d.solde]), 1)
  );
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const groupW = plotW / data.length;
  const barW = Math.min(28, groupW * 0.3);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));

  const linePts = data
    .map((d, i) => `${padL + groupW * (i + 0.5)},${y(d.solde)}`)
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Évolution des recettes, dépenses et solde créditeur par saison"
        className="w-full min-w-[480px]"
      >
        {/* Grille + axe Y */}
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--uwh-border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-[var(--uwh-text-soft)]"
              style={{ fontSize: '10px' }}
            >
              {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
            </text>
          </g>
        ))}

        {/* Barres */}
        {data.map((d, i) => {
          const xc = padL + groupW * (i + 0.5);
          return (
            <g key={d.label}>
              <rect
                x={xc - barW - 2}
                y={y(d.recettes)}
                width={barW}
                height={plotH + padT - y(d.recettes)}
                fill={C_REC}
                rx={2}
              >
                <title>{`${d.label} — recettes ${formatEuro(d.recettes, 0)}`}</title>
              </rect>
              <rect
                x={xc + 2}
                y={y(d.depenses)}
                width={barW}
                height={plotH + padT - y(d.depenses)}
                fill={C_DEP}
                rx={2}
              >
                <title>{`${d.label} — dépenses ${formatEuro(d.depenses, 0)}`}</title>
              </rect>
              <text
                x={xc}
                y={H - padB + 16}
                textAnchor="middle"
                className="fill-[var(--uwh-text-soft)]"
                style={{ fontSize: '10px' }}
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Ligne solde */}
        <polyline
          points={linePts}
          fill="none"
          stroke={C_SOLDE}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <circle
            key={d.label}
            cx={padL + groupW * (i + 0.5)}
            cy={y(d.solde)}
            r={3}
            fill={C_SOLDE}
          >
            <title>{`${d.label} — solde ${formatEuro(d.solde, 0)}`}</title>
          </circle>
        ))}
      </svg>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {[
          ['Total recettes', C_REC],
          ['Total dépenses', C_DEP],
          ['Solde créditeur', C_SOLDE],
        ].map(([label, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: color }}
            />
            {label}
          </li>
        ))}
      </ul>

      {/* Données accessibles (lecteur d'écran). Conteneur sr-only en <div> :
          un <table> ignore width/height:1px (table-layout) et resterait visible,
          son <caption> chevauchant alors le titre de la carte. */}
      <div className="sr-only">
        <table>
          <caption>Évolution par saison</caption>
          <thead>
            <tr>
              <th>Saison</th>
              <th>Recettes</th>
              <th>Dépenses</th>
              <th>Solde créditeur</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{formatEuro(d.recettes)}</td>
                <td>{formatEuro(d.depenses)}</td>
                <td>{formatEuro(d.solde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
