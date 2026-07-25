import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet.tsx';
import { I18nProvider } from '../../i18n/index.ts';

// Sheet consomme useI18n : chaque rendu doit être enveloppé dans le provider
// i18n (sinon useI18n lève « doit être utilisé dans son I18nProvider »).
const render = (ui: Parameters<typeof rtlRender>[0]) =>
  rtlRender(ui, { wrapper: I18nProvider });

/** Harnais : un déclencheur + une feuille dont l'ouverture est contrôlée. */
function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>ouvrir</button>
      <Sheet
        open={open}
        title="Feuille test"
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        footer={<button>Valider</button>}
      >
        <input aria-label="champ" />
      </Sheet>
    </>
  );
}

describe('Sheet (accessibilité)', () => {
  it('Échap déclenche onClose', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="T" onClose={onClose}>
        <input aria-label="x" />
      </Sheet>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restaure le focus sur le déclencheur à la fermeture', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'ouvrir' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.click(trigger); // ouvre → focus déplacé dans la feuille
    expect(trigger).not.toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' }); // ferme
    expect(trigger).toHaveFocus(); // focus rendu au déclencheur
  });

  it('piège le focus : Tab depuis le dernier élément revient au premier', () => {
    render(
      <Sheet
        open
        title="T"
        onClose={() => {}}
        footer={<button>Valider</button>}
      >
        <input aria-label="champ" />
      </Sheet>
    );
    const items = screen.getAllByRole('button');
    const first = screen.getByRole('button', { name: 'Fermer' });
    const last = items[items.length - 1]!;

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
});
