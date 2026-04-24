import { LIST_KIND_LABELS } from '@/domain/constants';
import type { ListRecord } from '@/domain/schemas/records';
import type { FinishListAction } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface FinishListDialogProps {
  busy?: boolean;
  error?: string | null;
  isOpen: boolean;
  list: ListRecord | null;
  onClose: () => void;
  onConfirm: (action: FinishListAction) => void;
}

function finishOptionsForKind(
  kind: ListRecord['kind'],
): Array<{
  action: FinishListAction;
  description: string;
  title: string;
}> {
  switch (kind) {
    case 'replenishment':
    case 'checklist':
      return [
        {
          action: 'archive-run-and-reset',
          title: 'Archive run and reset',
          description:
            'Preserve this finished run, then reopen the live list for reuse.',
        },
        {
          action: 'clear-items-for-reuse',
          title: 'Clear items for reuse',
          description:
            'Keep the list itself, remove the current items, and start fresh.',
        },
        {
          action: 'reset-checkmarks',
          title: 'Reset checkmarks and keep items',
          description:
            'Keep the current items and reopen the crossed-off ones.',
        },
        {
          action: 'archive-and-hide',
          title: 'Archive and hide',
          description:
            'Preserve this list as finished and remove it from active library views.',
        },
      ];
    case 'project':
      return [
        {
          action: 'clear-items-for-reuse',
          title: 'Clear items for reuse',
          description:
            'Keep the project shell and remove the current items from the live list.',
        },
        {
          action: 'reset-checkmarks',
          title: 'Reset checkmarks and keep items',
          description:
            'Keep the list structure and reopen what was crossed off.',
        },
        {
          action: 'archive-and-hide',
          title: 'Archive and hide',
          description:
            'Preserve this finished state and remove it from active library views.',
        },
      ];
    case 'reference':
      return [
        {
          action: 'archive-and-hide',
          title: 'Archive and hide',
          description:
            'Preserve this list for later retrieval without leaving it in active library views.',
        },
      ];
  }
}

export function FinishListDialog({
  busy = false,
  error = null,
  isOpen,
  list,
  onClose,
  onConfirm,
}: FinishListDialogProps) {
  if (!list) {
    return null;
  }

  const options = finishOptionsForKind(list.kind);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finish list">
      <div className="dialog-stack">
        <div className="dialog-header">
          <div>
            <div className="eyebrow">{LIST_KIND_LABELS[list.kind]} list</div>
            <h2>Finish {list.title}</h2>
            <p>Choose what should happen to this list next.</p>
          </div>
        </div>

        <div className="stack compact">
          {options.map((option) => (
            <button
              className="item-card finish-option"
              disabled={busy}
              key={option.action}
              onClick={() => onConfirm(option.action)}
              type="button"
            >
              <div className="item-title-row">
                <h3>{option.title}</h3>
              </div>
              <p>{option.description}</p>
            </button>
          ))}
        </div>

        {error ? <p className="auth-feedback danger">{error}</p> : null}

        <div className="dialog-actions spread">
          <button className="button ghost" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
