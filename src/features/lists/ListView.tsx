import { useMemo, useState } from 'react';

import type { DateKey } from '@/domain/dates';
import {
  createListItem,
  deleteListItem,
  promoteListItemToNow,
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
  listId: string;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ListView({
  currentDate,
  listId,
  onOpenItem,
  snapshot,
}: ListViewProps) {
  const [draft, setDraft] = useState('');
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
        promotedItemId: current.promotedItemId,
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
    const promotedItem = entry.promotedItemId
      ? snapshot.items.find((item) => item.id === entry.promotedItemId) ?? null
      : null;
    const isConflict = entry.syncState === 'conflict';
    const conflictBusy = listItemConflictBusyId === entry.id;
    const conflictError =
      listItemConflictErrorId === entry.id ? listItemConflictError : null;

    return (
      <div className="item-card day-result" key={entry.id}>
        <div className="item-title-row">
          <h3>{entry.title}</h3>
          <div className="chip-row">
            {isConflict ? <span className="chip small">Needs attention</span> : null}
            {promotedItem ? <span className="chip small">In Now</span> : null}
            {entry.status === 'done' ? (
              <span className="chip small">Done</span>
            ) : null}
          </div>
        </div>
        {entry.body.trim() ? (
          <p>{entry.body}</p>
        ) : (
          <p>Still attached to this list surface.</p>
        )}
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
          {entry.status === 'open' ? (
            promotedItem ? (
              <button
                className="button ghost small"
                onClick={() => onOpenItem(promotedItem.id)}
                type="button"
              >
                Open task
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
          {entry.status === 'open' ? (
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
            <div className="eyebrow">{list.kind} list</div>
            <h1>{list.title}</h1>
            <p>
              Keep a living list without turning it into a second navigation
              system.
            </p>
          </div>
          <div className="chip-row">
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
          <h2>Open</h2>
          <p>What is still active in this list.</p>
        </div>
        {openItems.length ? (
          <div className="item-list">{openItems.map(renderListItemCard)}</div>
        ) : (
          <EmptyState>Nothing open in this list right now.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Done history</h2>
          <p>What this list already carried through.</p>
        </div>
        {doneItems.length ? (
          <div className="item-list">{doneItems.map(renderListItemCard)}</div>
        ) : (
          <EmptyState>No done history here yet.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
