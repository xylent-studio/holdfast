import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/shared/ui/Modal';

describe('Modal', () => {
  it('does not close on backdrop click by default', () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Example">
        <div>Body</div>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on escape when open', () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Example">
        <div>Body</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not steal focus from an active field when the parent rerenders', async () => {
    const renderModal = (version: number) => (
      <Modal isOpen onClose={() => undefined} title="Example">
        <label>
          Draft {version}
          <input aria-label="Draft" />
        </label>
      </Modal>
    );
    const { rerender } = render(renderModal(1));
    const input = screen.getByLabelText('Draft');

    input.focus();
    expect(input).toHaveFocus();

    rerender(renderModal(2));

    await waitFor(() => {
      expect(screen.getByLabelText('Draft')).toHaveFocus();
    });
  });

  it('keeps tab focus inside the dialog', () => {
    render(
      <Modal isOpen onClose={() => undefined} title="Example">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );

    const firstButton = screen.getByRole('button', { name: 'First' });
    const lastButton = screen.getByRole('button', { name: 'Last' });

    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstButton).toHaveFocus();

    firstButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastButton).toHaveFocus();
  });
});
