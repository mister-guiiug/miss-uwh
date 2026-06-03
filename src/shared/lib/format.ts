/** Formatage localisé FR : montants en euros, dates, pourcentages. */

export function formatEuro(value: number, decimals = 2): string {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Montant signé lisible : +1 219,36 € / −44,00 €. */
export function formatSignedEuro(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatEuro(Math.abs(value), decimals)}`;
}

/** Date ISO -> 12 janv. 2026. */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Date ISO -> 12/01/2026 (compact, journaux). */
export function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

/** Horodatage (audit) -> 12/01/2026 14:03. */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
