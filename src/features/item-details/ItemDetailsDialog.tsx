import { useMemo, useState } from 'react';

import { ITEM_KIND_LABELS } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import type { ItemKind, ItemStatus, ListKind } from '@/domain/schemas/records';
import {
  addFilesToItem,
  deleteItem,
  getAttachmentDownload,
  removeAttachment,
  replaceItemWithLatestSavedVersion,
  saveItem,
  sendInboxCaptureToList,
  sendInboxCaptureToNewList,
  toggleFocus,
  type HoldfastSnapshot,
  type ItemWithAttachments,
} from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

import { ListCreatorFields } from '@/features/lists/ListCreatorFields';

interface ItemDetailsDialogProps {
  isFocused: boolean;
  currentDate: DateKey;
  isOpen: boolean;
  item: ItemWithAttachments;
  lists: HoldfastSnapshot['lists'];
  onClose: () => void;
  onOpenList: (listId: string) => void;
}

type PlacementChoice =
  | 'inbox'
  | 'now'
  | 'scheduled'
  | 'undated'
  | 'waiting'
  | 'list'
  | 'archive';

function formatBytes(value: number): string {
  if (!value) {
    return '0 B';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function initialPlacement(item: ItemWithAttachments): PlacementChoice {
  if (item.status === 'archived') {
    return 'archive';
  }

  if (item.kind === 'capture') {
    return 'inbox';
  }

  if (item.status === 'today') {
    return 'now';
  }

  if (item.status === 'waiting') {
    return 'waiting';
  }

  if (item.status === 'upcoming') {
    return item.scheduledDate ? 'scheduled' : 'undated';
  }

  return 'inbox';
}

export function ItemDetailsDialog({
  currentDate,
  isFocused,
  isOpen,
  item,
  lists,
  onClose,
  onOpenList,
}: ItemDetailsDialogProps) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [placement, setPlacement] = useState<PlacementChoice>(
    initialPlacement(item),
  );
  const [scheduledDate, setScheduledDate] = useState(
    item.scheduledDate ?? currentDate,
  );
  const [scheduledTime, setScheduledTime] = useState(item.scheduledTime ?? '');
  const [markDone, setMarkDone] = useState(item.status === 'done');
  const availableLists = useMemo(
    () => lists.filter((entry) => !entry.deletedAt && entry.pinned),
    [lists],
  );
  const [listTargetMode, setListTargetMode] = useState<'existing' | 'new'>(
    availableLists.length ? 'existing' : 'new',
  );
  const [selectedListId, setSelectedListId] = useState<string | null>(
    availableLists[0]?.id ?? null,
  );
  const [newListTitle, setNewListTitle] = useState('');
  const [newListKind, setNewListKind] = useState<ListKind>('project');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [replacingConflict, setReplacingConflict] = useState(false);

  const isConflict = item.syncState === 'conflict';
  const selectedListTitle =
    availableLists.find((entry) => entry.id === selectedListId)?.title ?? null;
  const showsNowByDateMessage =
    kind !== 'capture' &&
    item.status === 'upcoming' &&
    Boolean(item.scheduledDate) &&
    item.scheduledDate <= currentDate &&
    placement === 'scheduled';

  const handlePlacementChange = (nextPlacement: PlacementChoice): void => {
    setPlacement(nextPlacement);
    if (nextPlacement !== 'archive') {
      setMarkDone(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (kind === 'capture' && placement === 'list') {
      if (listTargetMode === 'new') {
        const listId = await sendInboxCaptureToNewList(item.id, {
          title: newListTitle.trim(),
          kind: newListKind,
          lane: 'admin',
        });
        if (listId) {
          onClose();
          onOpenList(listId);
        }
        return;
      }

      if (!selectedListId) {
        return;
      }

      await sendInboxCaptureToList(item.id, selectedListId);
      onClose();
      return;
    }

    const nextStatus: ItemStatus =
      kind === 'capture'
        ? placement === 'archive'
          ? 'archived'
          : 'inbox'
        : markDone && kind === 'task'
          ? 'done'
          : placement === 'now'
            ? 'today'
            : placement === 'scheduled' || placement === 'undated'
              ? 'upcoming'
              : placement === 'waiting'
                ? 'waiting'
                : placement === 'archive'
                  ? 'archived'
                  : 'inbox';
    const nextScheduledDate =
      kind === 'capture'
        ? null
        : placement === 'now'
          ? currentDate
          : placement === 'scheduled'
            ? scheduledDate || currentDate
            : null;
    const nextScheduledTime =
      kind === 'capture'
        ? null
        : placement === 'scheduled' && nextScheduledDate
          ? scheduledTime || null
          : null;

    await saveItem(item.id, {
      title,
      body,
      kind,
      lane: item.lane,
      status: nextStatus,
      scheduledDate: nextScheduledDate,
      scheduledTime: nextScheduledTime,
    });

    onClose();
  };

  const handleDelete = async (): Promise<void> => {
    await deleteItem(item.id);
    onClose();
  };

  const handleUseLatestSavedVersion = async (): Promise<void> => {
    setConflictError(null);
    setReplacingConflict(true);

    try {
      await replaceItemWithLatestSavedVersion(item.id);
      onClose();
    } catch (error) {
      setConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load the latest saved version yet.",
      );
    } finally {
      setReplacingConflict(false);
    }
  };

  const handleDownload = async (attachmentId: string): Promise<void> => {
    setDownloadError(null);
    setDownloadingAttachmentId(attachmentId);

    const payload = await getAttachmentDownload(attachmentId).catch(() => null);
    if (!payload) {
      setDownloadingAttachmentId(null);
      setDownloadError(
        "Couldn't download this file yet. Keep this device signed in and online, then try again.",
      );
      return;
    }

    const url = URL.createObjectURL(payload.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = payload.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setDownloadingAttachmentId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Item details">
      <div className="dialog-stack">
        <div className="dialog-header">
          <div>
            <div className="eyebrow">{ITEM_KIND_LABELS[kind]}</div>
            <h2>Keep it clear and in the right place.</h2>
            <p>Write first. Place it honestly. Shape it only when you need to.</p>
          </div>
          {kind !== 'capture' ? (
            <button
              className="button ghost"
              onClick={() => void toggleFocus(currentDate, item.id)}
              type="button"
            >
              {item.status === 'today'
                ? isFocused
                  ? 'Remove focus'
                  : 'Add focus'
                : 'Move to Now + focus'}
            </button>
          ) : null}
        </div>

        {isConflict ? (
          <div className="recovery-note">
            <strong>This changed in two places.</strong>
            <p>
              Keep this version if it still matters, or pull in the latest saved
              version before you keep moving.
            </p>
            <div className="dialog-actions">
              <button
                className="button ghost"
                disabled={replacingConflict}
                onClick={() => void handleUseLatestSavedVersion()}
                type="button"
              >
                {replacingConflict ? 'Loading...' : 'Use latest saved version'}
              </button>
            </div>
            {conflictError ? (
              <p className="auth-feedback danger">{conflictError}</p>
            ) : null}
          </div>
        ) : null}

        <label className="field-stack">
          <span>Title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            type="text"
            value={title}
          />
        </label>

        <label className="field-stack">
          <span>Notes</span>
          <textarea
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            value={body}
          />
        </label>

        <div className="field-stack">
          <span>Placement</span>
          <div className="chip-row">
            <button
              className={`chip ${placement === 'inbox' ? 'active' : ''}`}
              onClick={() => handlePlacementChange('inbox')}
              type="button"
            >
              Keep in Inbox
            </button>
            {kind === 'capture' ? (
              <button
                className={`chip ${placement === 'list' ? 'active' : ''}`}
                onClick={() => handlePlacementChange('list')}
                type="button"
              >
                Send to list
              </button>
            ) : (
              <>
                <button
                  className={`chip ${placement === 'now' ? 'active' : ''}`}
                  onClick={() => handlePlacementChange('now')}
                  type="button"
                >
                  Move to Now
                </button>
                <button
                  className={`chip ${placement === 'scheduled' ? 'active' : ''}`}
                  onClick={() => handlePlacementChange('scheduled')}
                  type="button"
                >
                  Scheduled
                </button>
                <button
                  className={`chip ${placement === 'undated' ? 'active' : ''}`}
                  onClick={() => handlePlacementChange('undated')}
                  type="button"
                >
                  Undated
                </button>
                <button
                  className={`chip ${placement === 'waiting' ? 'active' : ''}`}
                  onClick={() => handlePlacementChange('waiting')}
                  type="button"
                >
                  Waiting on
                </button>
              </>
            )}
            <button
              className={`chip ${placement === 'archive' ? 'active' : ''}`}
              onClick={() => handlePlacementChange('archive')}
              type="button"
            >
              Archive
            </button>
          </div>
        </div>

        {kind !== 'capture' && kind === 'task' ? (
          <div className="field-stack">
            <span>Task state</span>
            <div className="chip-row">
              <button
                className={`chip ${markDone ? 'active' : ''}`}
                onClick={() => setMarkDone((current) => !current)}
                type="button"
              >
                {markDone ? 'Reopen' : 'Done'}
              </button>
            </div>
          </div>
        ) : null}

        {placement === 'scheduled' && kind !== 'capture' ? (
          <div className="grid two">
            <label className="field-stack">
              <span>Date</span>
              <input
                onChange={(event) => setScheduledDate(event.target.value)}
                type="date"
                value={scheduledDate}
              />
            </label>
            <label className="field-stack">
              <span>Time</span>
              <input
                onChange={(event) => setScheduledTime(event.target.value)}
                type="time"
                value={scheduledTime}
              />
            </label>
          </div>
        ) : null}

        {showsNowByDateMessage ? (
          <div className="empty-inline">
            {item.scheduledDate === currentDate
              ? 'This is showing in Now because its scheduled date has arrived.'
              : 'This is showing in Now because its scheduled date has already passed.'}
          </div>
        ) : null}

        {kind === 'capture' && placement === 'list' ? (
          <div className="item-card day-result">
            <div className="field-stack">
              <span>Choose a list</span>
              <div className="chip-row">
                {availableLists.map((list) => (
                  <button
                    className={`chip ${
                      listTargetMode === 'existing' && selectedListId === list.id
                        ? 'active'
                        : ''
                    }`}
                    key={list.id}
                    onClick={() => {
                      setListTargetMode('existing');
                      setSelectedListId(list.id);
                    }}
                    type="button"
                  >
                    {list.title}
                  </button>
                ))}
                <button
                  className={`chip ${listTargetMode === 'new' ? 'active' : ''}`}
                  onClick={() => setListTargetMode('new')}
                  type="button"
                >
                  New list...
                </button>
              </div>
            </div>
            {listTargetMode === 'existing' && !selectedListTitle ? (
              <div className="empty-inline">
                Pin a list or create a new one first.
              </div>
            ) : null}
            {listTargetMode === 'new' ? (
              <ListCreatorFields
                kind={newListKind}
                onKindChange={setNewListKind}
                onTitleChange={setNewListTitle}
                title={newListTitle}
              />
            ) : null}
          </div>
        ) : null}

        <div className="field-stack">
          <span>Convert to</span>
          <div className="chip-row">
            <button
              className={`chip ${kind === 'capture' ? 'active' : ''}`}
              onClick={() => {
                setKind('capture');
                setMarkDone(false);
                if (!['inbox', 'list', 'archive'].includes(placement)) {
                  setPlacement('inbox');
                }
              }}
              type="button"
            >
              Capture
            </button>
            <button
              className={`chip ${kind === 'task' ? 'active' : ''}`}
              onClick={() => {
                setKind('task');
                if (placement === 'list') {
                  setPlacement('inbox');
                }
              }}
              type="button"
            >
              Task
            </button>
            <button
              className={`chip ${kind === 'note' ? 'active' : ''}`}
              onClick={() => {
                setKind('note');
                setMarkDone(false);
                if (placement === 'list') {
                  setPlacement('inbox');
                }
              }}
              type="button"
            >
              Note
            </button>
          </div>
        </div>

        <div className="field-stack">
          <span>Attachments</span>
          {item.attachments.length ? (
            <div className="attachment-list">
              {item.attachments.map((attachment) => (
                <div className="attachment-row" key={attachment.id}>
                  <div>
                    <div className="attachment-name">{attachment.name}</div>
                    <div className="attachment-meta">
                      {attachment.kind} | {formatBytes(attachment.size)}
                    </div>
                  </div>
                  <div className="attachment-actions">
                    <button
                      className="button ghost small"
                      onClick={() => void handleDownload(attachment.id)}
                      type="button"
                    >
                      {downloadingAttachmentId === attachment.id
                        ? 'Downloading...'
                        : 'Download'}
                    </button>
                    <button
                      className="button danger small"
                      onClick={() => void removeAttachment(attachment.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">No attachments yet.</div>
          )}
          {downloadError ? (
            <p className="auth-feedback danger">{downloadError}</p>
          ) : null}
          <label className="button ghost file-button">
            <input
              multiple
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) {
                  void addFilesToItem(item.id, files);
                }
                event.target.value = '';
              }}
              type="file"
            />
            Add files
          </label>
        </div>

        <div className="dialog-actions spread">
          <button
            className="button danger"
            onClick={() => void handleDelete()}
            type="button"
          >
            Delete
          </button>
          <div className="dialog-actions">
            <button className="button ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="button accent"
              disabled={
                kind === 'capture' &&
                placement === 'list' &&
                ((listTargetMode === 'existing' && !selectedListId) ||
                  (listTargetMode === 'new' && !newListTitle.trim()))
              }
              onClick={() => void handleSave()}
              type="button"
            >
              {isConflict ? 'Keep this version' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
