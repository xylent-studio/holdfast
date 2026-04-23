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

  it('starts inbox-first even in Now, while still offering a direct context action', () => {
    render(
      <QuickAddDialog
        currentDate="2026-04-20"
        isOpen
        lists={[]}
        onClose={vi.fn()}
        preferredPlacement="today"
      />,
    );

    expect(screen.getByRole('button', { name: 'Save to Inbox' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add to Now' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Now' }),
    ).not.toBeInTheDocument();
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

  it('reveals directed placement only when asked and can add to a pinned list', () => {
    render(
      <QuickAddDialog
        currentDate="2026-04-20"
        isOpen
        lists={[
          {
            id: 'list-1',
            schemaVersion: 2,
            title: 'Groceries',
            kind: 'replenishment',
            lane: 'home',
            pinned: true,
            sourceItemId: null,
            archivedAt: null,
            createdAt: '2026-04-20T08:00:00.000Z',
            updatedAt: '2026-04-20T08:00:00.000Z',
            deletedAt: null,
            syncState: 'pending',
            remoteRevision: null,
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('What do you need to keep?'), {
      target: { value: 'Eggs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose another place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Groceries' }));

    expect(createListItemMock).toHaveBeenCalledWith({
      body: '',
      listId: 'list-1',
      title: 'Eggs',
    });
  });
});
