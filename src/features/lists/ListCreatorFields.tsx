import { LIST_KIND_LABELS } from '@/domain/constants';
import { LIST_KIND_OPTIONS } from '@/domain/logic/capture';
import type { ListKind } from '@/domain/schemas/records';

interface ListCreatorFieldsProps {
  disabled?: boolean;
  kind: ListKind;
  onKindChange: (kind: ListKind) => void;
  onTitleChange: (value: string) => void;
  title: string;
  titleLabel?: string;
  titlePlaceholder?: string;
}

export function ListCreatorFields({
  disabled = false,
  kind,
  onKindChange,
  onTitleChange,
  title,
  titleLabel = 'Title',
  titlePlaceholder = 'Groceries, project, or reference',
}: ListCreatorFieldsProps) {
  return (
    <>
      <label className="field-stack">
        <span>{titleLabel}</span>
        <input
          autoFocus
          disabled={disabled}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          type="text"
          value={title}
        />
      </label>
      <div className="field-stack">
        <span>Kind</span>
        <div className="chip-row">
          {LIST_KIND_OPTIONS.map((option) => (
            <button
              className={`chip ${kind === option ? 'active' : ''}`}
              disabled={disabled}
              key={option}
              onClick={() => onKindChange(option)}
              type="button"
            >
              {LIST_KIND_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
