import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createTranslator } from '@mister-guiiug/dev-pwa-config/react/i18n';
import { I18nProvider } from '../../i18n/index.ts';
import { SocleLabels } from '../../i18n/SocleLabels.tsx';
import { messages } from '../../i18n/messages.ts';
import { useAppStore } from '../../store/useAppStore.ts';
import type { AiSettings } from '../../shared/types/domain.ts';
import { AiError } from '../../shared/lib/aiClient.ts';
import {
  ReceiptError,
  acceptNotice,
  describeReceiptError,
  hasAcceptedNotice,
  isPdfFile,
  type ReceiptDraft,
} from './receipt.ts';

/**
 * « Lire le justificatif », vu de l'écran. La lecture elle-même est tenue par
 * `receiptOcr.test.ts` ; ici, les trois promesses du geste :
 *  - sans clé, il est grisé et mène aux Réglages ;
 *  - au premier envoi, il DIT où part le justificatif, et n'envoie rien sans
 *    accord ;
 *  - il pré-remplit, et c'est tout : l'enregistrement reste au formulaire.
 */

const readReceipt =
  vi.fn<(file: File, ai: AiSettings) => Promise<ReceiptDraft>>();
vi.mock('./receiptOcr.ts', () => ({
  readReceipt: (file: File, ai: AiSettings) => readReceipt(file, ai),
}));

const { ReceiptScanner } = await import('./ReceiptScanner.tsx');

const anthropic: AiSettings = { provider: 'anthropic', apiKey: 'sk-ant' };
const openai: AiSettings = {
  provider: 'openai',
  apiKey: 'sk-oa',
  model: 'gpt-4o',
  baseUrl: 'https://openrouter.ai/api/v1',
};

const onRead = vi.fn<(draft: ReceiptDraft) => void>();

function mount(ai: AiSettings | undefined) {
  useAppStore.setState(s => ({
    data: { ...s.data, settings: { ...s.data.settings, ai } },
  }));
  const view = render(
    <MemoryRouter>
      <I18nProvider>
        <SocleLabels>
          <ReceiptScanner onRead={onRead} />
        </SocleLabels>
      </I18nProvider>
    </MemoryRouter>
  );
  const [camera, picker] =
    view.container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  return { camera: camera!, picker: picker! };
}

function pick(input: HTMLInputElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

const photo = () => new File(['x'], 'ticket.jpg', { type: 'image/jpeg' });
const facture = () =>
  new File(['%PDF'], 'facture.pdf', { type: 'application/pdf' });

beforeEach(() => {
  localStorage.setItem('uwh_locale', 'fr');
  readReceipt.mockReset();
  onRead.mockReset();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ReceiptScanner', () => {
  it('sans clé, le geste est grisé et un lien mène aux Réglages', () => {
    mount({ provider: 'anthropic' });

    expect(
      screen.getByRole('button', { name: /Photographier/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Choisir un fichier/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'Réglages → Génération IA' })
    ).toHaveAttribute('href', '/settings');
  });

  it('au premier envoi, il dit où part le justificatif — et n’envoie rien sans accord', async () => {
    const { camera } = mount(anthropic);

    pick(camera, photo());

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Claude (Anthropic)');
    expect(dialog.textContent).toContain('api.anthropic.com');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(readReceipt).not.toHaveBeenCalled();
    expect(hasAcceptedNotice(anthropic)).toBe(false);
  });

  it('accord donné : la lecture pré-remplit, et l’écran dit la confiance', async () => {
    readReceipt.mockResolvedValue({
      date: '2026-09-20',
      amount: 12.5,
      label: 'Piscine',
      sens: 'debit',
      categoryCode: 'D9',
      confidence: 0.9,
    });
    const { camera } = mount(anthropic);

    pick(camera, photo());
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer' }));

    await waitFor(() =>
      expect(onRead).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12.5, categoryCode: 'D9' })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Pré-rempli par l’IA (confiance 90 %)'
    );
    expect(hasAcceptedNotice(anthropic)).toBe(true);
  });

  it('l’accord retenu, la question ne revient pas', async () => {
    acceptNotice(anthropic);
    readReceipt.mockResolvedValue({ amount: 3, sens: 'debit' });
    const { picker } = mount(anthropic);

    pick(picker, photo());

    await waitFor(() => expect(readReceipt).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Sens lu sans catégorie : l'écran demande de la choisir.
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Dépense détectée : choisissez la catégorie.'
    );
  });

  it('un PDF chez un fournisseur qui ne le lit pas est refusé avant l’accord et avant tout envoi', () => {
    const { picker } = mount(openai);

    pick(picker, facture());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ce fournisseur ne lit pas les PDF'
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(readReceipt).not.toHaveBeenCalled();
  });

  it('un échec est dit, traduit', async () => {
    acceptNotice(anthropic);
    readReceipt.mockRejectedValue(new AiError('auth', 'refus'));
    const { picker } = mount(anthropic);

    pick(picker, photo());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Clé API refusée'
    );
    expect(onRead).not.toHaveBeenCalled();
  });
});

describe('receipt.ts', () => {
  it('isPdfFile : au type, ou à l’extension', () => {
    expect(isPdfFile({ type: 'application/pdf', name: 'a' })).toBe(true);
    expect(isPdfFile({ type: '', name: 'Facture.PDF' })).toBe(true);
    expect(isPdfFile({ type: 'image/jpeg', name: 'ticket.jpg' })).toBe(false);
  });

  it('l’accord vaut pour UN destinataire : changer de fournisseur ou d’hôte le redemande', () => {
    acceptNotice(anthropic);
    expect(hasAcceptedNotice(anthropic)).toBe(true);
    expect(hasAcceptedNotice({ ...anthropic, apiKey: 'autre-clé' })).toBe(true);
    expect(hasAcceptedNotice(openai)).toBe(false);
    expect(
      hasAcceptedNotice({ ...openai, baseUrl: 'https://api.openai.com/v1' })
    ).toBe(false);
  });

  it('describeReceiptError traduit chaque échec', () => {
    const fr = createTranslator(messages, 'fr', 'fr');
    const en = createTranslator(messages, 'en', 'fr');
    expect(
      describeReceiptError(new ReceiptError('too-large', 'x'), fr)
    ).toMatch(/trop lourd/);
    expect(describeReceiptError(new ReceiptError('empty', 'x'), en)).toMatch(
      /Nothing readable/
    );
    expect(
      describeReceiptError(new AiError('http', 'x', { status: 400 }), fr)
    ).toBe(
      'Le fournisseur d’IA a refusé la requête (HTTP 400) : le modèle configuré lit-il les images ?'
    );
    expect(describeReceiptError(new AiError('rate', 'x'), fr)).toMatch(/Quota/);
    expect(describeReceiptError(new Error('?'), fr)).toBe(
      'Lecture impossible. Saisissez l’écriture à la main.'
    );
  });
});
