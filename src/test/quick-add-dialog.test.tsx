import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuickAddDialog } from '@/features/capture/QuickAddDialog';

const createItemMock = vi.fn();
const createListItemMock = vi.fn();
const createListWithFirstItemMock = vi.fn();

vi.mock('@/storage/local/api', () => ({
  createItem: (...args: unknown[]) => createItemMock(...args),
  createListItem: (...args: unknown[]) => createListItemMock(...args),
  createListWithFirstItem: (...args: unknown[]) =>
    createListWithFirstItemMock(...args),
}));

describe('QuickAddDialog', () => {
  beforeEach(() => {
    createItemMock.mockReset();
    createListItemMock.mockReset();
    createListWithFirstItemMock.mockReset();
  });

  it('defaults to the current context in Now while keeping Inbox as a fallback', () => {
    render(
      <QuickAddDialog
        context="now"
        currentDate="2026-04-20"
        isOpen
        lists={[]}
        onClose={vi.fn()}
        onOpenList={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add to Now' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save to Inbox' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Scheduled' }),
    ).not.toBeInTheDocument();
  });

  it('uses the active upcoming section to choose the primary submit action', () => {
    render(
      <QuickAddDialog
        context="upcoming-waiting"
        currentDate="2026-04-20"
        isOpen
        lists={[]}
        onClose={vi.fn()}
        onOpenList={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('What do you need to keep?'), {
      target: { value: 'Waiting on contract' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Waiting on' }));

    expect(createItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        captureMode: 'context',
        kind: 'task',
        scheduledDate: null,
        status: 'waiting',
      }),
    );
  });

  it('defaults to the current list on list routes', () => {
    render(
      <QuickAddDialog
        context="list"
        currentDate="2026-04-20"
        currentListId="list-1"
        isOpen
        lists={[
          {
            id: 'list-1',
            schemaVersion: 3,
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
        onOpenList={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Add to Groceries' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save to Inbox' })).toBeVisible();
  });

  it('reveals all other destinations only when asked and shows schedule fields only for scheduled', () => {
    render(
      <QuickAddDialog
        context="global"
        currentDate="2026-04-20"
        isOpen
        lists={[
          {
            id: 'list-1',
            schemaVersion: 3,
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
        onOpenList={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('What do you need to keep?'), {
      target: { value: 'Eggs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose another place' }));

    expect(screen.getByRole('button', { name: 'Now' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Scheduled' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undated' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Waiting on' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Groceries' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'New list...' })).toBeVisible();
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scheduled' }));

    expect(screen.getByLabelText('Date')).toBeVisible();
    expect(screen.getByLabelText('Time')).toBeVisible();
  });

  it('can quick-create a new list from Add and use the draft as the first list item', () => {
    render(
      <QuickAddDialog
        context="global"
        currentDate="2026-04-20"
        isOpen
        lists={[]}
        onClose={vi.fn()}
        onOpenList={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('What do you need to keep?'), {
      target: { value: 'Eggs\nCheck pantry first' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose another place' }));
    fireEvent.click(screen.getByRole('button', { name: 'New list...' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Groceries' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replenishment' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Create list and add first item' }),
    );

    expect(createListWithFirstItemMock).toHaveBeenCalledWith(
      {
        title: 'Groceries',
        kind: 'replenishment',
        lane: 'admin',
      },
      {
        title: 'Eggs',
        body: 'Check pantry first',
      },
    );
  });
});
