import { useEffect, useMemo, useState } from 'react';

import { LIST_KIND_LABELS } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import {
  createTaskFromListItem,
  createListItem,
  deleteListItem,
  promoteListItemToNow,
  reopenAllDoneListItems,
  replaceListItemWithLatestSavedVersion,
  replaceListWithLatestSavedVersion,
  updateList,
  updateListItem,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Panel } from '@/shared/ui/Panel';

interface ListViewProps {
  currentDate: DateKey;
  highlightListItemId?: string | null;
  listId: string;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ListView({
  currentDate,
  highlightListItemId = null,
  listId,
  onOpenItem,
  snapshot,
}: ListViewProps) {
  const [draft, setDraft] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [listConflictBusy, setListConflictBusy] = useState(false);
  const [listConflictError, setListConflictError] = useState<string | null>(null);
  const [listItemConflictBusyId, setListItemConflictBusyId] = useState<
    string | null
  >(null);
  const [listItemConflictErrorId, setListItemConflictErrorId] = useState<
    string | null
  >(null);
  const [listItemConflictError, setListItemConflictError] = useState<
    string | null
  >(null);
  const list = snapshot.lists.find((entry) => entry.id === listId) ?? null;
  const items = useMemo(
    () =>
      snapshot.listItems
        .filter((entry) => entry.listId === listId && !entry.deletedAt)
        .sort((left, right) => left.position - right.position),
    [listId, snapshot.listItems],
  );
  const openItems = items.filter((entry) => entry.status === 'open');
  const doneItems = items.filter((entry) => entry.status === 'done');
  const archivedItems = items.filter((entry) => entry.status === 'archived');
  const listDescription = (() => {
    if (!list) {
      return '';
    }

    switch (list.kind) {
      case 'replenishment':
        return 'Keep a reusable list without losing what you already picked up.';
      case 'checklist':
        return 'Keep a repeatable checklist without turning it into a project board.';
      case 'reference':
        return 'Keep saved things close without pretending they all belong in Now.';
      case 'project':
      default:
        return 'Keep a living list without turning it into command clutter.';
    }
  })();

  useEffect(() => {
    if (!highlightListItemId) {
      return;
    }

    document
      .querySelector<HTMLElement>(`[data-list-item-id="${highlightListItemId}"]`)
      ?.scrollIntoView({ block: 'center' });
  }, [highlightListItemId]);

  if (!list) {
    return (
      <Panel>
        <div className="panel-header">
          <h1>List not found</h1>
          <p>This list is gone or archived.</p>
        </div>
      </Panel>
    );
  }

  const currentListDescription =
    list.kind === 'reference'
      ? 'What is still worth keeping close here.'
      : 'What still belongs on this list right now.';

  const handleQuickAdd = async (): Promise<void> => {
    if (!draft.trim()) {
      return;
    }

    await createListItem({
      listId,
      title: draft.trim(),
    });
    setDraft('');
  };

  const handleUseLatestSavedList = async (): Promise<void> => {
    setListConflictError(null);
    setListConflictBusy(true);

    try {
      await replaceListWithLatestSavedVersion(list.id);
    } catch (error) {
      setListConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load the latest saved version yet.",
      );
    } finally {
      setListConflictBusy(false);
    }
  };

  const handleKeepLocalList = async (): Promise<void> => {
    setListConflictError(null);
    setListConflictBusy(true);

    try {
      await updateList(list.id, {
        title: list.title,
        kind: list.kind,
        lane: list.lane,
        pinned: list.pinned,
        archivedAt: list.archivedAt,
      });
    } catch (error) {
      setListConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save this version yet.",
      );
    } finally {
      setListConflictBusy(false);
    }
  };

  const handleUseLatestSavedListItem = async (
    listItemId: string,
  ): Promise<void> => {
    setListItemConflictError(null);
    setListItemConflictErrorId(null);
    setListItemConflictBusyId(listItemId);

    try {
      await replaceListItemWithLatestSavedVersion(listItemId);
    } catch (error) {
      setListItemConflictErrorId(listItemId);
      setListItemConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load the latest saved version yet.",
      );
    } finally {
      setListItemConflictBusyId(null);
    }
  };

  const handleKeepLocalListItem = async (
    listItemId: string,
  ): Promise<void> => {
    const current = items.find((entry) => entry.id === listItemId);
    if (!current) {
      return;
    }

    setListItemConflictError(null);
    setListItemConflictErrorId(null);
    setListItemConflictBusyId(listItemId);

    try {
      await updateListItem(listItemId, {
        title: current.title,
        body: current.body,
        status: current.status,
        position: current.position,
        sourceItemId: current.sourceItemId,
        nowDate: current.nowDate,
      });
    } catch (error) {
      setListItemConflictErrorId(listItemId);
      setListItemConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save this version yet.",
      );
    } finally {
      setListItemConflictBusyId(null);
    }
  };

  const renderListItemCard = (entry: (typeof items)[number]) => {
    const sourceItem = entry.sourceItemId
      ? snapshot.items.find((item) => item.id === entry.sourceItemId) ?? null
      : null;
    const isConflict = entry.syncState === 'conflict';
    const conflictBusy = listItemConflictBusyId === entry.id;
    const conflictError =
      listItemConflictErrorId === entry.id ? listItemConflictError : null;

    return (
      <div
        className={`item-card day-result ${
          highlightListItemId === entry.id ? 'focus' : ''
        }`}
        data-list-item-id={entry.id}
        key={entry.id}
      >
        <div className="item-title-row">
          <h3>{entry.title}</h3>
          <div className="chip-row">
            {isConflict ? <span className="chip small">Needs attention</span> : null}
            {entry.nowDate ? <span className="chip small">In Now</span> : null}
            {entry.status === 'done' ? (
              <span className="chip small">Done</span>
            ) : null}
            {entry.status === 'archived' ? (
              <span className="chip small">Archived</span>
            ) : null}
          </div>
        </div>
        {entry.body.trim() ? (
          <p>{entry.body}</p>
        ) : null}
        {isConflict ? (
          <div className="recovery-note">
            <strong>This list item changed in two places.</strong>
            <p>
              Keep this version if it still matters here, or pull in the latest
              saved version before you keep moving.
            </p>
            <div className="dialog-actions">
              <button
                className="button ghost"
                disabled={conflictBusy}
                onClick={() => void handleKeepLocalListItem(entry.id)}
                type="button"
              >
                Keep this version
              </button>
              <button
                className="button ghost"
                disabled={conflictBusy}
                onClick={() => void handleUseLatestSavedListItem(entry.id)}
                type="button"
              >
                {conflictBusy ? 'Loading...' : 'Use latest saved version'}
              </button>
            </div>
            {conflictError ? (
              <p className="auth-feedback danger">{conflictError}</p>
            ) : null}
          </div>
        ) : null}
        <div className="dialog-actions">
          {entry.status === 'done' ? (
            <button
              className="button ghost small"
              onClick={() => void updateListItem(entry.id, { status: 'open' })}
              type="button"
            >
              Reopen
            </button>
          ) : (
            <button
              className="button ghost small"
              onClick={() => void updateListItem(entry.id, { status: 'done' })}
              type="button"
            >
              Done
            </button>
          )}
          {entry.status === 'open' && list.kind !== 'reference' ? (
            entry.nowDate ? (
              <button
                className="button ghost small"
                onClick={() => void updateListItem(entry.id, { nowDate: null })}
                type="button"
              >
                Remove from Now
              </button>
            ) : (
              <button
                className="button ghost small"
                onClick={() => void promoteListItemToNow(entry.id, currentDate)}
                type="button"
              >
                Send to Now
              </button>
            )
          ) : null}
          {entry.status === 'open' && list.kind !== 'reference' ? (
            <button
              className="button ghost small"
              onClick={() =>
                void createTaskFromListItem(entry.id, currentDate).then((itemId) => {
                  if (itemId) {
                    onOpenItem(itemId);
                  }
                })
              }
              type="button"
            >
              Create task
            </button>
          ) : null}
          {entry.status === 'done' && list.kind === 'replenishment' ? (
            <button
              className="button ghost small"
              onClick={() =>
                void createListItem({
                  listId: list.id,
                  title: entry.title,
                  body: entry.body,
                  sourceItemId: entry.sourceItemId,
                })
              }
              type="button"
            >
              Add again
            </button>
          ) : null}
          {sourceItem && entry.status !== 'archived' ? (
            <button
              className="button ghost small"
              onClick={() => onOpenItem(sourceItem.id)}
              type="button"
            >
              Open original
            </button>
          ) : null}
          {entry.status !== 'archived' ? (
            <button
              className="button danger small"
              onClick={() => void deleteListItem(entry.id)}
              type="button"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <div className="eyebrow">{LIST_KIND_LABELS[list.kind]} list</div>
            <h1>{list.title}</h1>
            <p>{listDescription}</p>
          </div>
          <div className="chip-row">
            <span className="chip small">
              {openItems.length} current
            </span>
            {doneItems.length ? (
              <span className="chip small">{doneItems.length} done</span>
            ) : null}
            {list.syncState === 'conflict' ? (
              <span className="chip small">Needs attention</span>
            ) : null}
            {list.pinned ? <span className="chip active">Pinned</span> : null}
            <button
              className="button ghost small"
              onClick={() => void updateList(list.id, { pinned: !list.pinned })}
              type="button"
            >
              {list.pinned ? 'Unpin' : 'Pin'}
            </button>
          </div>
        </div>
        {list.syncState === 'conflict' ? (
          <div className="recovery-note">
            <strong>This list changed in two places.</strong>
            <p>
              Keep this version if it is still the right one here, or pull in the
              latest saved version before you keep moving.
            </p>
            <div className="dialog-actions">
              <button
                className="button ghost"
                disabled={listConflictBusy}
                onClick={() => void handleKeepLocalList()}
                type="button"
              >
                Keep this version
              </button>
              <button
                className="button ghost"
                disabled={listConflictBusy}
                onClick={() => void handleUseLatestSavedList()}
                type="button"
              >
                {listConflictBusy ? 'Loading...' : 'Use latest saved version'}
              </button>
            </div>
            {listConflictError ? (
              <p className="auth-feedback danger">{listConflictError}</p>
            ) : null}
          </div>
        ) : null}
        <label className="field-stack">
          <span>Add to this list</span>
          <div className="inline-form">
            <input
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleQuickAdd();
                }
              }}
              placeholder={`Add to ${list.title}`}
              type="text"
              value={draft}
            />
            <button
              className="button accent"
              onClick={() => void handleQuickAdd()}
              type="button"
            >
              Add
            </button>
          </div>
        </label>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Current</h2>
          <p>{currentListDescription}</p>
        </div>
        {openItems.length ? (
          <div className="item-list">{openItems.map(renderListItemCard)}</div>
        ) : (
          <EmptyState>Nothing current in this list right now.</EmptyState>
        )}
      </Panel>

      {doneItems.length ? (
        <Panel>
          <div className="panel-header split">
            <div>
              <h2>Done</h2>
              <p>What this list already carried through.</p>
            </div>
            <div className="dialog-actions">
              {list.kind === 'checklist' ? (
                <button
                  className="button ghost small"
                  onClick={() => void reopenAllDoneListItems(list.id)}
                  type="button"
                >
                  Reopen all done
                </button>
              ) : null}
              <button
                className="button ghost small"
                onClick={() => setDoneOpen((current) => !current)}
                type="button"
              >
                {doneOpen ? 'Hide done' : `Show done (${doneItems.length})`}
              </button>
            </div>
          </div>
          {doneOpen ? (
            <div className="item-list">{doneItems.map(renderListItemCard)}</div>
          ) : (
            <div className="empty-inline">
              Done items stay out of the way until you need them.
            </div>
          )}
        </Panel>
      ) : null}

      {archivedItems.length ? (
        <Panel>
          <div className="panel-header">
            <h2>Archived</h2>
            <p>Older list items kept for retrieval, not current work.</p>
          </div>
          <div className="item-list">
            {archivedItems.map(renderListItemCard)}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
