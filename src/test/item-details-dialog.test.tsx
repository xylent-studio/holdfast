import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { ItemDetailsDialog } from '@/features/item-details/ItemDetailsDialog';

const addFilesToItemMock = vi.fn();
const deleteItemMock = vi.fn();
const getAttachmentDownloadMock = vi.fn();
const moveItemToListMock = vi.fn();
const moveItemToNewListMock = vi.fn();
const removeAttachmentMock = vi.fn();
const replaceItemWithLatestSavedVersionMock = vi.fn();
const saveItemMock = vi.fn();
const setItemFocusMock = vi.fn();

vi.mock('@/storage/local/api', () => ({
  addFilesToItem: (...args: unknown[]) => addFilesToItemMock(...args),
  deleteItem: (...args: unknown[]) => deleteItemMock(...args),
  getAttachmentDownload: (...args: unknown[]) => getAttachmentDownloadMock(...args),
  moveItemToList: (...args: unknown[]) => moveItemToListMock(...args),
  moveItemToNewList: (...args: unknown[]) => moveItemToNewListMock(...args),
  removeAttachment: (...args: unknown[]) => removeAttachmentMock(...args),
  replaceItemWithLatestSavedVersion: (...args: unknown[]) =>
    replaceItemWithLatestSavedVersionMock(...args),
  saveItem: (...args: unknown[]) => saveItemMock(...args),
  setItemFocus: (...args: unknown[]) => setItemFocusMock(...args),
}));

function baseLists() {
  return [
    {
      id: 'list-1',
      schemaVersion: SCHEMA_VERSION,
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
  ];
}

describe('ItemDetailsDialog', () => {
  beforeEach(() => {
    addFilesToItemMock.mockReset();
    deleteItemMock.mockReset();
    getAttachmentDownloadMock.mockReset();
    moveItemToListMock.mockReset();
    moveItemToNewListMock.mockReset();
    replaceItemWithLatestSavedVersionMock.mockReset();
    removeAttachmentMock.mockReset();
    saveItemMock.mockReset();
    setItemFocusMock.mockReset();
  });

  it('shows a visible error when an attachment cannot be downloaded', async () => {
    getAttachmentDownloadMock.mockResolvedValue(null);

    render(
      <ItemDetailsDialog
        currentDate="2026-04-20"
        isFocused={false}
        isOpen
        item={{
          attachments: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              schemaVersion: SCHEMA_VERSION,
              itemId: '22222222-2222-4222-8222-222222222222',
              name: 'receipt.txt',
              kind: 'file',
              mimeType: 'text/plain',
              size: 12,
              blobId: '33333333-3333-4333-8333-333333333333',
              createdAt: '2026-04-20T08:00:00.000Z',
              updatedAt: '2026-04-20T08:00:00.000Z',
              deletedAt: null,
              syncState: 'synced',
              remoteRevision: null,
            },
          ],
          body: '',
          captureMode: null,
          createdAt: '2026-04-20T08:00:00.000Z',
          id: '22222222-2222-4222-8222-222222222222',
          kind: 'task',
          lane: 'admin',
          schemaVersion: SCHEMA_VERSION,
          scheduledDate: null,
          scheduledTime: null,
          sourceDate: '2026-04-20',
          sourceItemId: null,
          sourceText: null,
          routineId: null,
          completedAt: null,
          archivedAt: null,
          status: 'inbox',
          syncState: 'synced',
          title: 'Receipt',
          updatedAt: '2026-04-20T08:00:00.000Z',
          deletedAt: null,
        }}
        lists={baseLists()}
        onClose={vi.fn()}
        onOpenList={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Couldn't download this file yet. Keep this device signed in and online, then try again.",
        ),
      ).toBeVisible();
    });
  });

  it('surfaces a calm conflict path and can pull in the latest saved version', async () => {
    replaceItemWithLatestSavedVersionMock.mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ItemDetailsDialog
        currentDate="2026-04-20"
        isFocused={false}
        isOpen
        item={{
          attachments: [],
          body: 'Local version',
          captureMode: null,
          createdAt: '2026-04-20T08:00:00.000Z',
          id: '22222222-2222-4222-8222-222222222222',
          kind: 'task',
          lane: 'admin',
          schemaVersion: SCHEMA_VERSION,
          scheduledDate: null,
          scheduledTime: null,
          sourceDate: '2026-04-20',
          sourceItemId: null,
          sourceText: null,
          routineId: null,
          completedAt: null,
          archivedAt: null,
          status: 'inbox',
          syncState: 'conflict',
          remoteRevision: 'server-2',
          title: 'Conflict item',
          updatedAt: '2026-04-20T08:00:00.000Z',
          deletedAt: null,
        }}
        lists={baseLists()}
        onClose={onClose}
        onOpenList={vi.fn()}
      />,
    );

    expect(screen.getByText('This changed in two places.')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Use latest saved version' }),
    );

    await waitFor(() => {
      expect(replaceItemWithLatestSavedVersionMock).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222',
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('can send an inbox capture into a pinned list', async () => {
    moveItemToListMock.mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ItemDetailsDialog
        currentDate="2026-04-20"
        isFocused={false}
        isOpen
        item={{
          attachments: [],
          body: 'Check pantry first',
          captureMode: 'uncertain',
          createdAt: '2026-04-20T08:00:00.000Z',
          id: '22222222-2222-4222-8222-222222222222',
          kind: 'capture',
          lane: 'admin',
          schemaVersion: SCHEMA_VERSION,
          scheduledDate: null,
          scheduledTime: null,
          sourceDate: '2026-04-20',
          sourceItemId: null,
          sourceText: 'Eggs\n\nCheck pantry first',
          routineId: null,
          completedAt: null,
          archivedAt: null,
          status: 'inbox',
          syncState: 'pending',
          remoteRevision: null,
          title: 'Eggs',
          updatedAt: '2026-04-20T08:00:00.000Z',
          deletedAt: null,
        }}
        lists={baseLists()}
        onClose={onClose}
        onOpenList={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Convert to list item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(moveItemToListMock).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222',
        'list-1',
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
