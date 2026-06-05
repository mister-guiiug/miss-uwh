/**
 * Génération d'attestations / reçus de cotisation imprimables (PDF via la boîte
 * d'impression du navigateur). `buildAttestationHtml` est pur (testable) ;
 * `printAttestations` ouvre un document autonome et lance l'impression — une
 * attestation par page.
 */
import { formatEuro } from '../../shared/lib/format.ts';

export interface AttestationMember {
  name: string;
  amount: number;
}

export interface AttestationParams {
  clubName: string;
  treasurer?: string;
  seasonLabel: string;
  /** Date du jour, déjà formatée (ex. « 6 juin 2026 »). */
  dateLabel: string;
  members: AttestationMember[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attestationSection(
  m: AttestationMember,
  p: AttestationParams
): string {
  return `<section class="page">
    <header><h1>${esc(p.clubName)}</h1></header>
    <h2>Attestation de cotisation</h2>
    <p>Le club <strong>${esc(p.clubName)}</strong> atteste que
    <strong>${esc(m.name)}</strong> s'est acquitté(e) de sa cotisation d'un
    montant de <strong>${esc(formatEuro(m.amount))}</strong> au titre de la
    saison <strong>${esc(p.seasonLabel)}</strong>.</p>
    <p class="foot">Fait le ${esc(p.dateLabel)}.${
      p.treasurer
        ? ` <br/>Le/La trésorier·ère : <strong>${esc(p.treasurer)}</strong>`
        : ''
    }</p>
  </section>`;
}

export function buildAttestationHtml(p: AttestationParams): string {
  const sections = p.members.map(m => attestationSection(m, p)).join('\n');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Attestations — ${esc(p.clubName)} ${esc(p.seasonLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #111; margin: 0; }
  .page { padding: 28mm 22mm; min-height: 100vh; }
  .page + .page { page-break-before: always; }
  header h1 { font-size: 18pt; margin: 0 0 24mm; }
  h2 { font-size: 15pt; margin: 0 0 10mm; }
  p { font-size: 12pt; line-height: 1.6; }
  .foot { margin-top: 24mm; }
  @media print { @page { margin: 0; } }
</style></head>
<body onload="window.print()">
${sections}
</body></html>`;
}

export function printAttestations(p: AttestationParams): boolean {
  if (p.members.length === 0) return false;
  const w = window.open('', '_blank', 'width=820,height=920');
  if (!w) return false; // bloqueur de pop-up
  w.document.write(buildAttestationHtml(p));
  w.document.close();
  w.focus();
  return true;
}
