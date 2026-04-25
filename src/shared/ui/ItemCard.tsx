import { useMemo, useState } from 'react';

import type { AttachmentRecord } from '@/domain/schemas/records';
import type { SurfaceActionSpec } from '@/domain/logic/surface-actions';
import type { ItemWithAttachments } from '@/storage/local/api';
import { useCompactLayout } from '@/shared/ui/useCompactLayout';

interface ItemCardProps {
  actions?: SurfaceActionSpec[];
  focus?: boolean;
  item: ItemWithAttachments;
  meta: string[];
  onOpen: () => void;
  onAction?: (actionId: SurfaceActionSpec['id']) => void;
  onToggleDone?: () => void;
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
  actions = [],
  focus = false,
  item,
  meta,
  onAction,
  onOpen,
  onToggleDone,
}: ItemCardProps) {
  const attachmentSummary = countAttachments(item.attachments);
  const preview = previewText(item.body, item.kind === 'task' ? 120 : 220);
  const cardClass = item.kind === 'task' ? 'task' : 'note';
  const badgeLabel = item.kind === 'capture' ? 'Capture' : 'Note';
  const compactActionLayout = useCompactLayout();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { inlineActions, overflowActions } = useMemo(() => {
    if (!compactActionLayout) {
      return { inlineActions: actions, overflowActions: [] as SurfaceActionSpec[] };
    }

    const firstPrimary = actions.find((action) => action.priority === 'primary');
    const firstVisible =
      firstPrimary ??
      actions.find((action) => action.priority === 'secondary') ??
      actions[0] ??
      null;
    const firstSecondary = actions.find(
      (action) => action.id !== firstVisible?.id && action.priority === 'secondary',
    );
    const inline = [firstVisible, firstSecondary].filter(
      (action): action is SurfaceActionSpec => Boolean(action),
    );
    const visibleIds = new Set(inline.map((action) => action.id));

    return {
      inlineActions: inline,
      overflowActions: actions.filter((action) => !visibleIds.has(action.id)),
    };
  }, [actions, compactActionLayout]);

  return (
    <article className={`item-card ${cardClass} ${focus ? 'focus' : ''}`}>
      <div className="item-row">
        {item.kind === 'task' && onToggleDone ? (
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
        {inlineActions.map((action) => (
          <button
            className={`button ${action.tone === 'accent' ? 'accent' : action.tone === 'danger' ? 'danger' : 'ghost'} small`}
            key={action.id}
            onClick={() => onAction?.(action.id)}
            type="button"
          >
            {action.label}
          </button>
        ))}
        {compactActionLayout && overflowActions.length ? (
          <button
            className="button ghost small"
            onClick={() => setOverflowOpen((current) => !current)}
            type="button"
          >
            {overflowOpen ? 'Less' : 'More'}
          </button>
        ) : null}
        <button className="button ghost" onClick={onOpen} type="button">
          Details
        </button>
      </div>
      {compactActionLayout && overflowOpen && overflowActions.length ? (
        <div className="item-actions item-actions-overflow">
          {overflowActions.map((action) => (
            <button
              className={`button ${action.tone === 'accent' ? 'accent' : action.tone === 'danger' ? 'danger' : 'ghost'} small`}
              key={`overflow-${action.id}`}
              onClick={() => onAction?.(action.id)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
