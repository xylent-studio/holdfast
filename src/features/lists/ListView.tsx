import { useMemo, useState } from 'react';

import type { DateKey } from '@/domain/dates';
import {
  createListItem,
  deleteListItem,
  promoteListItemToNow,
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
          <div className="item-list">
            {openItems.map((entry) => {
              const promotedItem = entry.promotedItemId
                ? snapshot.items.find((item) => item.id === entry.promotedItemId) ??
                  null
                : null;

              return (
                <div className="item-card day-result" key={entry.id}>
                  <div className="item-title-row">
                    <h3>{entry.title}</h3>
                    {promotedItem ? (
                      <span className="chip small">In Now</span>
                    ) : null}
                  </div>
                  {entry.body.trim() ? (
                    <p>{entry.body}</p>
                  ) : (
                    <p>Still attached to this list surface.</p>
                  )}
                  <div className="dialog-actions">
                    <button
                      className="button ghost small"
                      onClick={() =>
                        void updateListItem(entry.id, { status: 'done' })
                      }
                      type="button"
                    >
                      Done
                    </button>
                    {promotedItem ? (
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
                        onClick={() =>
                          void promoteListItemToNow(entry.id, currentDate)
                        }
                        type="button"
                      >
                        Send to Now
                      </button>
                    )}
                    <button
                      className="button danger small"
                      onClick={() => void deleteListItem(entry.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
          <div className="item-list">
            {doneItems.map((entry) => (
              <div className="item-card day-result" key={entry.id}>
                <div className="item-title-row">
                  <h3>{entry.title}</h3>
                  <span className="chip small">Done</span>
                </div>
                {entry.body.trim() ? <p>{entry.body}</p> : null}
                <div className="dialog-actions">
                  <button
                    className="button ghost small"
                    onClick={() => void updateListItem(entry.id, { status: 'open' })}
                    type="button"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No done history here yet.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
