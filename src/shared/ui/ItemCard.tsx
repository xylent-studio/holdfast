import type { AttachmentRecord } from '@/domain/schemas/records';
import type { ItemWithAttachments } from '@/storage/local/api';

interface ItemCardProps {
  focus?: boolean;
  item: ItemWithAttachments;
  meta: string[];
  onOpen: () => void;
  onPrimaryAction?: () => void;
  onToggleDone?: () => void;
  primaryActionLabel?: string;
}

function previewText(value: string, limit: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }

  return `${trimmed.slice(0, limit).trimEnd()}...`;
}

function countAttachments(attachments: AttachmentRecord[]): string | null {
  if (!attachments.length) {
    return null;
  }

  const photos = attachments.filter(
    (attachment) => attachment.kind === 'image',
  ).length;
  const files = attachments.length - photos;
  const parts = [];
  if (photos) {
    parts.push(photos === 1 ? '1 photo' : `${photos} photos`);
  }
  if (files) {
    parts.push(files === 1 ? '1 file' : `${files} files`);
  }
  return parts.join(' | ');
}

export function ItemCard({
  focus = false,
  item,
  meta,
  onOpen,
  onPrimaryAction,
  onToggleDone,
  primaryActionLabel,
}: ItemCardProps) {
  const attachmentSummary = countAttachments(item.attachments);
  const preview = previewText(item.body, item.kind === 'task' ? 120 : 220);
  const cardClass = item.kind === 'task' ? 'task' : 'note';
  const badgeLabel = item.kind === 'capture' ? 'Capture' : 'Note';

  return (
    <article className={`item-card ${cardClass} ${focus ? 'focus' : ''}`}>
      <div className="item-row">
        {item.kind === 'task' ? (
          <button
            aria-label={
              item.status === 'done' ? 'Reopen task' : 'Complete task'
            }
            className={`check-button ${item.status === 'done' ? 'checked' : ''}`}
            onClick={onToggleDone}
            type="button"
          >
            {item.status === 'done' ? 'Done' : ''}
          </button>
        ) : (
          <div className="note-badge">{badgeLabel}</div>
        )}
        <div className="item-copy">
          <div className="item-title-row">
            <h3>{item.title}</h3>
            {focus ? <span className="chip accent small">Focus</span> : null}
          </div>
          {preview ? <p className="item-preview">{preview}</p> : null}
          {attachmentSummary ? (
            <div className="attachment-summary">{attachmentSummary}</div>
          ) : null}
          <div className="meta-row">
            {meta.map((entry) => (
              <span className="meta-chip" key={entry}>
                {entry}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="item-actions">
        {primaryActionLabel && onPrimaryAction ? (
          <button
            className="button accent"
            onClick={onPrimaryAction}
            type="button"
          >
            {primaryActionLabel}
          </button>
        ) : null}
        <button className="button ghost" onClick={onOpen} type="button">
          Details
        </button>
      </div>
    </article>
  );
}
