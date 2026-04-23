import { useMemo, useState } from 'react';

import { addDays } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import { buildListTargetGroups, inferListKind } from '@/domain/logic/list-targets';
import { inboxItems, itemMeta } from '@/domain/logic/selectors';
import {
  moveItemToList,
  moveItemToNewList,
  saveItem,
  toggleTaskDone,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

import { ListCreatorFields } from '@/features/lists/ListCreatorFields';

interface InboxViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function InboxView({
  currentDate,
  onOpenItem,
  snapshot,
}: InboxViewProps) {
  const [filter, setFilter] = useState<'unsorted' | 'archived'>('unsorted');
  const [routingItemId, setRoutingItemId] = useState<string | null>(null);
  const [listTargetMode, setListTargetMode] = useState<'existing' | 'new'>(
    'existing',
  );
  const [listSearch, setListSearch] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const items = inboxItems(snapshot.items, filter);
  const activeLists = useMemo(
    () => snapshot.lists.filter((entry) => !entry.deletedAt && !entry.archivedAt),
    [snapshot.lists],
  );
  const routingItem = items.find((item) => item.id === routingItemId) ?? null;
  const routingDraftText = routingItem
    ? [routingItem.title, routingItem.body].filter(Boolean).join('\n\n')
    : '';
  const listTargetGroups = useMemo(
    () =>
      buildListTargetGroups(activeLists, {
        draftText: routingDraftText,
        search: listSearch,
      }),
    [activeLists, listSearch, routingDraftText],
  );
  const selectableLists = [
    ...listTargetGroups.suggested,
    ...listTargetGroups.recent,
    ...listTargetGroups.pinned,
    ...listTargetGroups.search,
  ].filter(
    (list, index, entries) =>
      entries.findIndex((entry) => entry.id === list.id) === index,
  );

  const routeItem = async (
    item: (typeof items)[number],
    destination: 'archive' | 'now' | 'scheduled' | 'undated' | 'waiting',
  ): Promise<void> => {
    const nextKind = item.kind === 'capture' && destination !== 'archive' ? 'task' : item.kind;
    const nextStatus =
      destination === 'archive'
        ? 'archived'
        : destination === 'now'
          ? 'today'
          : destination === 'waiting'
            ? 'waiting'
            : 'upcoming';

    await saveItem(item.id, {
      title: item.title,
      body: item.body,
      kind: nextKind,
      lane: item.lane,
      status: nextStatus,
      scheduledDate:
        destination === 'now'
          ? currentDate
          : destination === 'scheduled'
            ? addDays(currentDate, 1)
            : null,
      scheduledTime: null,
    });
  };

  const closeListRouting = (): void => {
    setRoutingItemId(null);
    setListTargetMode('existing');
    setListSearch('');
    setNewListTitle('');
    setSelectedListId(null);
  };

  const handleMoveToExistingList = async (): Promise<void> => {
    if (!routingItem || !selectedListId) {
      return;
    }

    await moveItemToList(routingItem.id, selectedListId);
    closeListRouting();
  };

  const handleMoveToNewList = async (): Promise<void> => {
    if (!routingItem || !newListTitle.trim()) {
      return;
    }

    await moveItemToNewList(routingItem.id, {
      title: newListTitle.trim(),
      kind: inferListKind(newListTitle),
      lane: routingItem.lane,
    });
    closeListRouting();
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <h1>Inbox</h1>
          <p>Use Add to catch it fast. Sort it when you need to.</p>
        </div>
        <div className="chip-row">
          {(
            [
              ['unsorted', 'Unsorted'],
              ['archived', 'Archived'],
            ] as const
          ).map(([value, label]) => (
            <button
              className={`chip ${filter === value ? 'active' : ''}`}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {items.length ? (
          <div className="item-list">
            {items.map((item) => (
              <div className="stack compact" key={item.id}>
                <ItemCard
                  item={item}
                  meta={itemMeta(item, currentDate, item.attachments)}
                  onOpen={() => onOpenItem(item.id)}
                  onToggleDone={
                    item.kind === 'task'
                      ? () => void toggleTaskDone(item.id, currentDate)
                      : undefined
                  }
                />
                {filter === 'unsorted' ? (
                  <div className="item-card day-result">
                    <div className="field-stack">
                      <span>Place it</span>
                      <div className="chip-row">
                        <button
                          className="chip"
                          onClick={() => void routeItem(item, 'now')}
                          type="button"
                        >
                          Now
                        </button>
                        <button
                          className="chip"
                          onClick={() => void routeItem(item, 'scheduled')}
                          type="button"
                        >
                          Scheduled
                        </button>
                        <button
                          className="chip"
                          onClick={() => void routeItem(item, 'undated')}
                          type="button"
                        >
                          Undated
                        </button>
                        <button
                          className="chip"
                          onClick={() => void routeItem(item, 'waiting')}
                          type="button"
                        >
                          Waiting on
                        </button>
                        <button
                          className={`chip ${routingItemId === item.id ? 'active' : ''}`}
                          onClick={() => {
                            setRoutingItemId(item.id);
                            setListTargetMode(activeLists.length ? 'existing' : 'new');
                            setListSearch('');
                            setNewListTitle('');
                            setSelectedListId(null);
                          }}
                          type="button"
                        >
                          List
                        </button>
                        <button
                          className="chip"
                          onClick={() => void routeItem(item, 'archive')}
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                    </div>

                    {routingItemId === item.id ? (
                      <div className="stack compact">
                        <div className="field-stack">
                          <span>Convert to list item</span>
                          <div className="chip-row">
                            <button
                              className={`chip ${listTargetMode === 'existing' ? 'active' : ''}`}
                              onClick={() => setListTargetMode('existing')}
                              type="button"
                            >
                              Existing
                            </button>
                            <button
                              className={`chip ${listTargetMode === 'new' ? 'active' : ''}`}
                              onClick={() => setListTargetMode('new')}
                              type="button"
                            >
                              New list
                            </button>
                          </div>
                        </div>
                        {listTargetMode === 'existing' ? (
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
                            <div className="chip-row">
                              {selectableLists.map((list) => (
                                <button
                                  className={`chip ${selectedListId === list.id ? 'active' : ''}`}
                                  key={list.id}
                                  onClick={() => setSelectedListId(list.id)}
                                  type="button"
                                >
                                  {list.title}
                                </button>
                              ))}
                            </div>
                            {!selectableLists.length ? (
                              <div className="empty-inline">
                                No matching lists. Create a new one if this needs its own home.
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <ListCreatorFields
                            kind={inferListKind(newListTitle)}
                            onKindChange={() => undefined}
                            onTitleChange={setNewListTitle}
                            showKind={false}
                            title={newListTitle}
                          />
                        )}
                        <div className="dialog-actions">
                          <button
                            className="button ghost small"
                            onClick={closeListRouting}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="button accent small"
                            disabled={
                              (listTargetMode === 'existing' && !selectedListId) ||
                              (listTargetMode === 'new' && !newListTitle.trim())
                            }
                            onClick={() =>
                              void (listTargetMode === 'existing'
                                ? handleMoveToExistingList()
                                : handleMoveToNewList())
                            }
                            type="button"
                          >
                            {listTargetMode === 'existing'
                              ? 'Convert to list item'
                              : 'Create list and convert'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Nothing here.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
