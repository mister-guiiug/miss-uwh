import { describe, expect, it } from 'vitest';
import { formatEuro } from '../../shared/lib/format.ts';
import { buildAttestationHtml, type AttestationParams } from './attestation.ts';

const base: AttestationParams = {
  clubName: 'Clermont Hockey Sub',
  treasurer: 'Jean Trésorier',
  seasonLabel: '2025-2026',
  dateLabel: '6 juin 2026',
  members: [
    { name: 'Alice Martin', amount: 160 },
    { name: 'Bob <Durand>', amount: 80 },
  ],
};

describe('buildAttestationHtml', () => {
  it('produit une page par membre avec saut de page', () => {
    const html = buildAttestationHtml(base);
    expect((html.match(/class="page"/g) ?? []).length).toBe(2);
    expect(html).toContain('page-break-before: always');
    expect(html).toContain('window.print()');
  });

  it('insère club, montant, saison et trésorier', () => {
    const html = buildAttestationHtml(base);
    expect(html).toContain('Clermont Hockey Sub');
    expect(html).toContain('Alice Martin');
    expect(html).toContain('2025-2026');
    expect(html).toContain('Jean Trésorier');
    expect(html).toContain(formatEuro(160));
  });

  it('échappe le HTML des données', () => {
    const html = buildAttestationHtml(base);
    expect(html).toContain('Bob &lt;Durand&gt;');
    expect(html).not.toContain('Bob <Durand>');
  });

  it('omet la ligne trésorier si absent', () => {
    const html = buildAttestationHtml({ ...base, treasurer: undefined });
    expect(html).not.toContain('trésorier·ère');
  });
});
