import { useState } from 'react';

import { ITEM_KIND_LABELS } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import type { ItemKind, ItemStatus } from '@/domain/schemas/records';
import {
  addFilesToItem,
  deleteItem,
  getAttachmentDownload,
  replaceItemWithLatestSavedVersion,
  removeAttachment,
  saveItem,
  toggleFocus,
} from '@/storage/local/api';
import type { ItemWithAttachments } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface ItemDetailsDialogProps {
  isFocused: boolean;
  currentDate: DateKey;
  isOpen: boolean;
  item: ItemWithAttachments;
  onClose: () => void;
}

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

function editablePlacement(item: ItemWithAttachments): ItemStatus {
  if (item.kind === 'capture') {
    return item.status === 'archived' ? 'archived' : 'inbox';
  }

  return item.status;
}

export function ItemDetailsDialog({
  currentDate,
  isFocused,
  isOpen,
  item,
  onClose,
}: ItemDetailsDialogProps) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [status, setStatus] = useState<ItemStatus>(editablePlacement(item));
  const [scheduledDate, setScheduledDate] = useState(item.scheduledDate ?? '');
  const [scheduledTime, setScheduledTime] = useState(item.scheduledTime ?? '');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [replacingConflict, setReplacingConflict] = useState(false);

  const canPlaceActively = kind !== 'capture';
  const isConflict = item.syncState === 'conflict';

  const handleSave = async (): Promise<void> => {
    const nextStatus =
      kind === 'capture'
        ? status === 'archived'
          ? 'archived'
          : 'inbox'
        : status;
    const nextScheduledDate =
      nextStatus === 'today'
        ? currentDate
        : nextStatus === 'upcoming'
          ? scheduledDate || null
          : null;
    const nextScheduledTime =
      nextStatus === 'upcoming' && nextScheduledDate
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
            <p>Placement first. Shape only when you need to.</p>
          </div>
          {kind !== 'capture' ? (
            <button
              className="button ghost"
              onClick={() => void toggleFocus(currentDate, item.id)}
              type="button"
            >
              {status === 'today'
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
              className={`chip ${status === 'inbox' ? 'active' : ''}`}
              onClick={() => setStatus('inbox')}
              type="button"
            >
              Keep in Inbox
            </button>
            <button
              className={`chip ${status === 'today' ? 'active' : ''}`}
              disabled={!canPlaceActively}
              onClick={() => setStatus('today')}
              type="button"
            >
              Move to Now
            </button>
            <button
              className={`chip ${status === 'upcoming' ? 'active' : ''}`}
              disabled={!canPlaceActively}
              onClick={() => setStatus('upcoming')}
              type="button"
            >
              Plan
            </button>
            <button
              className={`chip ${status === 'waiting' ? 'active' : ''}`}
              disabled={!canPlaceActively}
              onClick={() => setStatus('waiting')}
              type="button"
            >
              Waiting on
            </button>
            {kind === 'task' ? (
              <button
                className={`chip ${status === 'done' ? 'active' : ''}`}
                onClick={() => setStatus('done')}
                type="button"
              >
                Done
              </button>
            ) : null}
            <button
              className={`chip ${status === 'archived' ? 'active' : ''}`}
              onClick={() => setStatus('archived')}
              type="button"
            >
              Archive
            </button>
          </div>
        </div>

        {status === 'upcoming' ? (
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

        <div className="field-stack">
          <span>Shape as</span>
          <div className="chip-row">
            <button
              className={`chip ${kind === 'capture' ? 'active' : ''}`}
              onClick={() => {
                setKind('capture');
                if (status !== 'archived') {
                  setStatus('inbox');
                }
              }}
              type="button"
            >
              Capture
            </button>
            <button
              className={`chip ${kind === 'task' ? 'active' : ''}`}
              onClick={() => setKind('task')}
              type="button"
            >
              Task
            </button>
            <button
              className={`chip ${kind === 'note' ? 'active' : ''}`}
              onClick={() => {
                setKind('note');
                if (status === 'done') {
                  setStatus('inbox');
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
