import type { SurfaceActionSpec } from '@/domain/logic/surface-actions';
import type { ItemWithAttachments } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface ItemPlacementDialogProps {
  actions: SurfaceActionSpec[];
  item: ItemWithAttachments;
  onClose: () => void;
  onSelect: (action: SurfaceActionSpec) => void;
}

function previewText(value: string, limit = 180): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }

  return `${trimmed.slice(0, limit).trimEnd()}...`;
}

export function ItemPlacementDialog({
  actions,
  item,
  onClose,
  onSelect,
}: ItemPlacementDialogProps) {
  const preview = previewText(item.body);

  return (
    <Modal isOpen onClose={onClose} title="Place item">
      <div className="dialog-stack">
        <div className="dialog-header">
          <div>
            <div className="eyebrow">Place</div>
            <h2>{item.title}</h2>
            {preview ? <p>{preview}</p> : null}
          </div>
        </div>

        <div className="field-stack">
          <span>Choose a place</span>
          <div className="placement-choice-grid">
            {actions.map((action) => (
              <button
                className={`button ${
                  action.id === 'archive' ? 'danger' : 'ghost'
                }`}
                key={action.id}
                onClick={() => onSelect(action)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-actions spread">
          <button className="button ghost" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
