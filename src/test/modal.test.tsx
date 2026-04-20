import { fireEvent, render, screen } from '@testing-library/react';
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
});
