import { useMemo, useState } from 'react';

import { buildListTargetGroups, inferListKind } from '@/domain/logic/list-targets';
import type { ListKind, ListRecord } from '@/domain/schemas/records';
import { Modal } from '@/shared/ui/Modal';

import { ListCreatorFields } from '@/features/lists/ListCreatorFields';

interface ListTargetDialogProps {
  confirmExistingLabel?: string;
  confirmNewLabel?: string;
  draftText: string;
  initialMode?: 'existing' | 'new';
  lists: ListRecord[];
  onClose: () => void;
  onConfirmExisting: (listId: string) => Promise<void> | void;
  onConfirmNew: (input: { kind: ListKind; title: string }) => Promise<void> | void;
  title: string;
}

function ListTargetSection({
  title,
  lists,
  selectedListId,
  onSelect,
}: {
  title: string;
  lists: ListRecord[];
  selectedListId: string | null;
  onSelect: (listId: string) => void;
}) {
  if (!lists.length) {
    return null;
  }

  return (
    <div className="field-stack">
      <span>{title}</span>
      <div className="chip-row">
        {lists.map((list) => (
          <button
            className={`chip ${selectedListId === list.id ? 'active' : ''}`}
            key={list.id}
            onClick={() => onSelect(list.id)}
            type="button"
          >
            {list.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ListTargetDialog({
  confirmExistingLabel = 'Move to list',
  confirmNewLabel = 'Create list and move',
  draftText,
  initialMode = 'existing',
  lists,
  onClose,
  onConfirmExisting,
  onConfirmNew,
  title,
}: ListTargetDialogProps) {
  const activeLists = useMemo(
    () => lists.filter((entry) => !entry.deletedAt && !entry.archivedAt),
    [lists],
  );
  const [mode, setMode] = useState<'existing' | 'new'>(
    activeLists.length ? initialMode : 'new',
  );
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  const [newListKindOverride, setNewListKindOverride] = useState<ListKind | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listTargetGroups = useMemo(
    () =>
      buildListTargetGroups(activeLists, {
        draftText,
        search: listSearch,
      }),
    [activeLists, draftText, listSearch],
  );

  const selectableLists = useMemo(() => {
    const ordered = [
      ...listTargetGroups.suggested,
      ...listTargetGroups.recent,
      ...listTargetGroups.pinned,
      ...listTargetGroups.search,
    ];
    const seen = new Set<string>();

    return ordered.filter((list) => {
      if (seen.has(list.id)) {
        return false;
      }

      seen.add(list.id);
      return true;
    });
  }, [listTargetGroups]);

  const inferredNewListKind = inferListKind(newListTitle);
  const effectiveNewListKind =
    inferredNewListKind === 'project'
      ? newListKindOverride ?? inferredNewListKind
      : inferredNewListKind;

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      if (mode === 'existing') {
        if (!selectedListId) {
          return;
        }

        await onConfirmExisting(selectedListId);
        onClose();
        return;
      }

      const titleValue = newListTitle.trim();
      if (!titleValue) {
        return;
      }

      await onConfirmNew({
        kind: effectiveNewListKind,
        title: titleValue,
      });
      onClose();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Couldn't move that yet.",
      );
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={busy ? () => undefined : onClose} title={title}>
      <div className="dialog-stack">
        <div>
          <h2>{title}</h2>
          <p>Choose an existing list or create a new one without losing the original draft.</p>
        </div>

        <div className="field-stack">
          <span>Destination</span>
          <div className="chip-row">
            {activeLists.length ? (
              <button
                className={`chip ${mode === 'existing' ? 'active' : ''}`}
                onClick={() => setMode('existing')}
                type="button"
              >
                Existing list
              </button>
            ) : null}
            <button
              className={`chip ${mode === 'new' ? 'active' : ''}`}
              onClick={() => setMode('new')}
              type="button"
            >
              New list
            </button>
          </div>
        </div>

        {mode === 'existing' ? (
          <>
            <label className="field-stack">
              <span>Find a list</span>
              <input
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Search lists"
                type="search"
                value={listSearch}
              />
            </label>
            <ListTargetSection
              lists={listTargetGroups.suggested}
              onSelect={setSelectedListId}
              selectedListId={selectedListId}
              title="Suggested lists"
            />
            <ListTargetSection
              lists={listTargetGroups.recent}
              onSelect={setSelectedListId}
              selectedListId={selectedListId}
              title="Recent lists"
            />
            <ListTargetSection
              lists={listTargetGroups.pinned}
              onSelect={setSelectedListId}
              selectedListId={selectedListId}
              title="Pinned lists"
            />
            {listSearch.trim() ? (
              <ListTargetSection
                lists={listTargetGroups.search}
                onSelect={setSelectedListId}
                selectedListId={selectedListId}
                title="Matching lists"
              />
            ) : null}
            {!selectableLists.length ? (
              <div className="empty-inline">
                No lists yet. Create a new one if this needs its own home.
              </div>
            ) : null}
          </>
        ) : (
          <div className="stack compact">
            <ListCreatorFields
              kind={effectiveNewListKind}
              onKindChange={setNewListKindOverride}
              onTitleChange={(value) => {
                setNewListTitle(value);
                if (inferListKind(value) !== 'project') {
                  setNewListKindOverride(null);
                }
              }}
              showKind={false}
              title={newListTitle}
            />
            {inferListKind(newListTitle) === 'project' ? (
              <div className="field-stack">
                <span>Kind</span>
                <div className="chip-row">
                  <button
                    className={`chip ${effectiveNewListKind === 'project' ? 'active' : ''}`}
                    onClick={() => setNewListKindOverride('project')}
                    type="button"
                  >
                    Project
                  </button>
                  <button
                    className={`chip ${effectiveNewListKind === 'reference' ? 'active' : ''}`}
                    onClick={() => setNewListKindOverride('reference')}
                    type="button"
                  >
                    Reference
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className="auth-feedback danger">{error}</p> : null}

        <div className="dialog-actions spread">
          <button className="button ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="button accent"
            disabled={
              busy ||
              (mode === 'existing' && !selectedListId) ||
              (mode === 'new' && !newListTitle.trim())
            }
            onClick={() => void handleConfirm()}
            type="button"
          >
            {busy
              ? 'Saving...'
              : mode === 'existing'
                ? confirmExistingLabel
                : confirmNewLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
