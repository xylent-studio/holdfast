import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuickAddDialog } from '@/features/capture/QuickAddDialog';

const createItemMock = vi.fn();
const createListItemMock = vi.fn();

vi.mock('@/storage/local/api', () => ({
  createItem: (...args: unknown[]) => createItemMock(...args),
  createListItem: (...args: unknown[]) => createListItemMock(...args),
}));

describe('QuickAddDialog', () => {
  beforeEach(() => {
    createItemMock.mockReset();
    createListItemMock.mockReset();
  });

  it('defaults to current-context placement in Now', () => {
    render(
      <QuickAddDialog
        currentDate="2026-04-20"
        isOpen
        lists={[]}
        onClose={vi.fn()}
        preferredPlacement="today"
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Place now' }),
    ).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Now' })).toHaveClass('active');
  });

  it('uses context capture mode for upcoming placement defaults', () => {
    render(
      <QuickAddDialog
        currentDate="2026-04-20"
        isOpen
        lists={[]}
        onClose={vi.fn()}
        preferredPlacement="upcoming"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('What do you need to keep?'), {
      target: { value: 'Plan trip' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Upcoming' }));

    expect(createItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        captureMode: 'context',
        kind: 'task',
        scheduledDate: null,
        status: 'upcoming',
      }),
    );
  });
});
