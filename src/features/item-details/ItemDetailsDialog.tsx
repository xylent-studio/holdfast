import { useState } from 'react';

import { ITEM_KIND_LABELS, LANES } from '@/domain/constants';
import { todayDateKey, type DateKey } from '@/domain/dates';
import type { ItemKind, ItemStatus } from '@/domain/schemas/records';
import {
  addFilesToItem,
  deleteItem,
  getAttachmentDownload,
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
  const [lane, setLane] = useState<(typeof LANES)[number]['key']>(item.lane);
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [scheduledDate, setScheduledDate] = useState(item.scheduledDate ?? '');
  const [scheduledTime, setScheduledTime] = useState(item.scheduledTime ?? '');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const moveToCurrentDayLabel =
    currentDate === todayDateKey() ? 'Move to today' : 'Move to Now';
  const normalizedStatus =
    kind === 'capture'
      ? status === 'archived'
        ? 'archived'
        : 'inbox'
      : status;

  const handleSave = async (): Promise<void> => {
    const nextScheduledDate =
      normalizedStatus === 'today'
        ? currentDate
        : normalizedStatus === 'upcoming'
          ? scheduledDate || null
          : null;
    const nextScheduledTime = nextScheduledDate ? scheduledTime || null : null;

    await saveItem(item.id, {
      title,
      body,
      kind,
      lane,
      status: normalizedStatus,
      scheduledDate: nextScheduledDate,
      scheduledTime: nextScheduledTime,
    });

    onClose();
  };

  const handleDelete = async (): Promise<void> => {
    await deleteItem(item.id);
    onClose();
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
            <h2>Details</h2>
            <p>Keep it clear and in the right place.</p>
          </div>
          {kind !== 'capture' ? (
            <button
              className="button ghost"
              onClick={() => void toggleFocus(currentDate, item.id)}
              type="button"
            >
              {normalizedStatus === 'today'
                ? isFocused
                  ? 'Remove focus'
                  : 'Add focus'
                : `${moveToCurrentDayLabel} + focus`}
            </button>
          ) : null}
        </div>
        <label className="field-stack">
          <span>Title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            type="text"
            value={title}
          />
        </label>
        <div className="grid two">
          <label className="field-stack">
            <span>Type</span>
            <select
              onChange={(event) => setKind(event.target.value as ItemKind)}
              value={kind}
            >
              <option value="capture">Capture</option>
              <option value="task">Task</option>
              <option value="note">Note</option>
            </select>
          </label>
          {kind !== 'capture' ? (
            <label className="field-stack">
              <span>Area</span>
              <select
                onChange={(event) =>
                  setLane(event.target.value as (typeof LANES)[number]['key'])
                }
                value={lane}
              >
                {LANES.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <label className="field-stack">
          <span>Status</span>
          <select
            onChange={(event) => setStatus(event.target.value as ItemStatus)}
            value={normalizedStatus}
          >
            <option value="inbox">Inbox</option>
            {kind !== 'capture' ? <option value="today">Now</option> : null}
            {kind !== 'capture' ? (
              <option value="upcoming">Upcoming</option>
            ) : null}
            {kind !== 'capture' ? (
              <option value="waiting">Waiting on</option>
            ) : null}
            {kind === 'task' ? <option value="done">Done</option> : null}
            <option value="archived">Archived</option>
          </select>
        </label>
        {normalizedStatus === 'today' || normalizedStatus === 'upcoming' ? (
          <div className="grid two">
            <label className="field-stack">
              <span>Date</span>
              <input
                onChange={(event) => setScheduledDate(event.target.value)}
                type="date"
                value={
                  normalizedStatus === 'today' ? currentDate : scheduledDate
                }
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
        <label className="field-stack">
          <span>
            {kind === 'note'
              ? 'Notes'
              : kind === 'capture'
                ? 'Details'
                : 'Instructions'}
          </span>
          <textarea
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            value={body}
          />
        </label>
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
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
