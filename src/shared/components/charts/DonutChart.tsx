import { formatEuro } from '../../lib/format.ts';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut en SVG pur (technique stroke-dasharray, `pathLength=100`). Légende à
 * droite (empilée sous le donut sur petit écran). Accessible : rôle img + libellé.
 */
export function DonutChart({
  data,
  thickness = 22,
  ariaLabel,
}: {
  data: DonutSegment[];
  thickness?: number;
  ariaLabel: string;
}) {
  const segments = data.filter(d => d.value > 0);
  const total = segments.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return (
      <p className="px-2 py-6 text-sm text-[var(--uwh-text-soft)]">
        Aucune donnée à représenter.
      </p>
    );
  }

  const r = 50 - thickness / 2;
  // Décalages cumulés précalculés (pas de mutation pendant le rendu).
  const slices = segments.reduce<
    Array<DonutSegment & { pct: number; offset: number }>
  >((acc, d) => {
    const offset = acc.length
      ? acc[acc.length - 1]!.offset + acc[acc.length - 1]!.pct
      : 0;
    acc.push({ ...d, pct: (d.value / total) * 100, offset });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={ariaLabel}
        className="h-40 w-40 shrink-0"
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--uwh-border)"
          strokeWidth={thickness}
        />
        {slices.map((d, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            pathLength={100}
            strokeDasharray={`${d.pct} ${100 - d.pct}`}
            strokeDashoffset={-d.offset}
            transform="rotate(-90 50 50)"
          />
        ))}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[var(--uwh-text)] font-semibold"
          style={{ fontSize: '8px' }}
        >
          {formatEuro(total, 0)}
        </text>
      </svg>

      <ul className="flex w-full flex-col gap-1.5">
        {segments
          .slice()
          .sort((a, b) => b.value - a.value)
          .map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: d.color }}
              />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="tnum shrink-0 font-semibold">
                {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
      </ul>

      {/* Données accessibles (lecteur d'écran). Le conteneur sr-only est un
          <div> : un <table> ignore width/height:1px (table-layout) et resterait
          visible, son <caption> chevauchant alors le titre de la carte. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Montant</th>
              <th>Part</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((d, i) => (
              <tr key={i}>
                <td>{d.label}</td>
                <td>{formatEuro(d.value)}</td>
                <td>{Math.round((d.value / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
