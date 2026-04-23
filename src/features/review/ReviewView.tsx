import { useMemo, useState } from 'react';

import type { DateKey } from '@/domain/dates';
import {
  conflictedItems,
  conflictedListItems,
  conflictedLists,
  itemMeta,
  overdueItems,
  recentDaySummaries,
  repeatedOpenTitles,
  reviewListSummaries,
  searchWorkspace,
} from '@/domain/logic/selectors';
import { createList, type HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

interface ReviewViewProps {
  currentDate: DateKey;
  onJumpToDate: (date: DateKey) => void;
  onOpenItem: (itemId: string) => void;
  onOpenList: (listId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ReviewView({
  currentDate,
  onJumpToDate,
  onOpenItem,
  onOpenList,
  snapshot,
}: ReviewViewProps) {
  const [search, setSearch] = useState('');
  const [showMoreTrails, setShowMoreTrails] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listCreateBusy, setListCreateBusy] = useState(false);
  const [listCreateError, setListCreateError] = useState<string | null>(null);
  const repeated = useMemo(
    () => repeatedOpenTitles(snapshot.items),
    [snapshot.items],
  );
  const conflictItems = useMemo(
    () => conflictedItems(snapshot.items),
    [snapshot.items],
  );
  const conflictLists = useMemo(
    () => conflictedLists(snapshot.lists),
    [snapshot.lists],
  );
  const conflictListItems = useMemo(
    () => conflictedListItems(snapshot.listItems),
    [snapshot.listItems],
  );
  const overdue = useMemo(
    () => overdueItems(snapshot.items, currentDate),
    [currentDate, snapshot.items],
  );
  const searchResults = useMemo(
    () =>
      searchWorkspace(
        snapshot.items,
        snapshot.dailyRecords,
        snapshot.lists,
        snapshot.listItems,
        search,
      ),
    [
      search,
      snapshot.dailyRecords,
      snapshot.items,
      snapshot.listItems,
      snapshot.lists,
    ],
  );
  const recent = useMemo(
    () =>
      recentDaySummaries(snapshot.dailyRecords, snapshot.items, currentDate),
    [currentDate, snapshot.dailyRecords, snapshot.items],
  );
  const listSummaries = useMemo(
    () => reviewListSummaries(snapshot.lists, snapshot.listItems),
    [snapshot.listItems, snapshot.lists],
  );

  const handleOpenListCreator = (): void => {
    setIsCreatingList(true);
    setListCreateError(null);
  };

  const handleCancelListCreator = (): void => {
    if (listCreateBusy) {
      return;
    }

    setIsCreatingList(false);
    setListTitle('');
    setListCreateError(null);
  };

  const handleCreateList = async (): Promise<void> => {
    const title = listTitle.trim();
    if (!title) {
      return;
    }

    setListCreateBusy(true);
    setListCreateError(null);

    try {
      const listId = await createList({
        title,
        kind: 'project',
        lane: 'admin',
      });
      setListTitle('');
      setIsCreatingList(false);
      onOpenList(listId);
    } catch (error) {
      setListCreateError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't create this list yet.",
      );
    } finally {
      setListCreateBusy(false);
    }
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <h1>Review</h1>
          <p>Find saved things again and pull the right thing back into view.</p>
        </div>
        <label className="field-stack">
          <span>Search</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search captures, lists, list items, attachments, and day notes"
            type="search"
            value={search}
          />
        </label>
        {search.trim() ? (
          searchResults.length ? (
            <div className="item-list">
              {searchResults.map((result) => {
                if (result.type === 'item') {
                  return (
                    <ItemCard
                      item={result.item}
                      key={result.item.id}
                      meta={itemMeta(
                        result.item,
                        currentDate,
                        result.item.attachments,
                      )}
                      onOpen={() => onOpenItem(result.item.id)}
                    />
                  );
                }

                if (result.type === 'day') {
                  return (
                    <div className="item-card day-result" key={`day-${result.date}`}>
                      <div className="eyebrow">{result.date}</div>
                      <p>
                        {[
                          result.dailyRecord.launchNote,
                          result.dailyRecord.closeWin,
                          result.dailyRecord.closeCarry,
                          result.dailyRecord.closeSeed,
                          result.dailyRecord.closeNote,
                        ]
                          .filter(Boolean)
                          .join(' | ') || 'Day entry'}
                      </p>
                      <div className="dialog-actions">
                        <button
                          className="button ghost small"
                          onClick={() => onJumpToDate(result.date as DateKey)}
                          type="button"
                        >
                          Open day
                        </button>
                      </div>
                    </div>
                  );
                }

                if (result.type === 'list') {
                  return (
                    <div className="item-card day-result" key={`list-${result.list.id}`}>
                      <div className="eyebrow">
                        {result.list.kind} list
                        {result.list.pinned ? ' | pinned' : ''}
                      </div>
                      <div className="item-title-row">
                        <h3>{result.list.title}</h3>
                        <span className="chip small">
                          {result.openCount} open
                        </span>
                      </div>
                      <p>
                        {result.doneCount
                          ? `${result.doneCount} done item${
                              result.doneCount === 1 ? '' : 's'
                            } remembered here.`
                          : 'Ready to refind without adding another app inside Holdfast.'}
                      </p>
                      <div className="dialog-actions">
                        <button
                          className="button ghost small"
                          onClick={() => onOpenList(result.list.id)}
                          type="button"
                        >
                          Open list
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    className="item-card day-result"
                    key={`list-item-${result.listItem.id}`}
                  >
                    <div className="eyebrow">List item | {result.list.title}</div>
                    <div className="item-title-row">
                      <h3>{result.listItem.title}</h3>
                      <span className="chip small">
                        {result.listItem.status}
                      </span>
                    </div>
                    {result.listItem.body.trim() ? (
                      <p>{result.listItem.body}</p>
                    ) : (
                      <p>Still attached to its list surface.</p>
                    )}
                    <div className="dialog-actions">
                      <button
                        className="button ghost small"
                        onClick={() => onOpenList(result.list.id)}
                        type="button"
                      >
                        Open list
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState>No matches.</EmptyState>
          )
        ) : (
          <EmptyState>
            Search captures, lists, list items, attachments, or day notes.
          </EmptyState>
        )}
      </Panel>

      {conflictItems.length || conflictLists.length || conflictListItems.length ? (
        <Panel>
          <div className="panel-header">
            <h2>Needs attention</h2>
            <p>
              Something changed in two places. Open it and decide what still
              matters before you keep moving.
            </p>
          </div>
          <div className="stack compact">
            {conflictItems.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
              />
            ))}
            {conflictLists.map((list) => (
              <div className="item-card day-result" key={`conflict-list-${list.id}`}>
                <div className="eyebrow">{list.kind} list</div>
                <div className="item-title-row">
                  <h3>{list.title}</h3>
                  <span className="chip small">Needs attention</span>
                </div>
                <p>Open the list and decide what should stay.</p>
                <div className="dialog-actions">
                  <button
                    className="button ghost small"
                    onClick={() => onOpenList(list.id)}
                    type="button"
                  >
                    Open list
                  </button>
                </div>
              </div>
            ))}
            {conflictListItems.map((listItem) => {
              const list = snapshot.lists.find((entry) => entry.id === listItem.listId);
              if (!list) {
                return null;
              }

              return (
                <div
                  className="item-card day-result"
                  key={`conflict-list-item-${listItem.id}`}
                >
                  <div className="eyebrow">List item | {list.title}</div>
                  <div className="item-title-row">
                    <h3>{listItem.title}</h3>
                    <span className="chip small">Needs attention</span>
                  </div>
                  <p>Open the list and decide what should stay.</p>
                  <div className="dialog-actions">
                    <button
                      className="button ghost small"
                      onClick={() => onOpenList(list.id)}
                      type="button"
                    >
                      Open list
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="panel-header split">
          <div>
            <h2>Lists</h2>
            <p>Pinned and active list surfaces you can return to quickly.</p>
          </div>
          <div className="dialog-actions">
            <button
              className="button ghost small"
              onClick={() => handleOpenListCreator()}
              type="button"
            >
              New list
            </button>
          </div>
        </div>
        {isCreatingList ? (
          <div className="item-card day-result">
            <label className="field-stack">
              <span>Title</span>
              <input
                autoFocus
                onChange={(event) => setListTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleCreateList();
                  }
                }}
                placeholder="Groceries, project, or reference"
                type="text"
                value={listTitle}
              />
            </label>
            {listCreateError ? (
              <p className="auth-feedback danger">{listCreateError}</p>
            ) : null}
            <div className="dialog-actions spread">
              <button
                className="button ghost"
                disabled={listCreateBusy}
                onClick={() => handleCancelListCreator()}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button accent"
                disabled={!listTitle.trim() || listCreateBusy}
                onClick={() => void handleCreateList()}
                type="button"
              >
                {listCreateBusy ? 'Creating...' : 'Create list'}
              </button>
            </div>
          </div>
        ) : null}
        {listSummaries.length ? (
          <div className="grid two">
            {listSummaries.map((entry) => (
              <div className="item-card day-result" key={entry.list.id}>
                <div className="eyebrow">
                  {entry.list.kind} list
                  {entry.list.pinned ? ' | pinned' : ''}
                </div>
                <div className="item-title-row">
                  <h3>{entry.list.title}</h3>
                  <span className="chip small">{entry.openCount} open</span>
                </div>
                <p>
                  {entry.previewTitles.length
                    ? entry.previewTitles.join(' | ')
                    : 'Nothing open right now.'}
                </p>
                <div className="dialog-actions">
                  <button
                    className="button ghost small"
                    onClick={() => onOpenList(entry.list.id)}
                    type="button"
                  >
                    Open list
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No active lists to revisit yet.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header split">
          <div>
            <h2>More trails</h2>
            <p>Open this only when you need a little more history or pattern help.</p>
          </div>
          <div className="dialog-actions">
            <button
              className="button ghost small"
              onClick={() => setShowMoreTrails((current) => !current)}
              type="button"
            >
              {showMoreTrails ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {showMoreTrails ? (
          <div className="stack">
            <div className="stack compact">
              <div className="eyebrow">Recent days</div>
              <div className="grid two">
                {recent.map((day) => (
                  <div className="item-card day-result" key={day.date}>
                    <div className="eyebrow">{day.date}</div>
                    <div className="meta-row">
                      <span className="meta-chip">
                        Focus | {day.focusTitles.join(', ') || '--'}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-chip">Win | {day.closeWin || '--'}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-chip">
                        Seed | {day.closeSeed || '--'}
                      </span>
                    </div>
                    <div className="dialog-actions">
                      <button
                        className="button ghost small"
                        onClick={() => onJumpToDate(day.date as DateKey)}
                        type="button"
                      >
                        Open day
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid two">
              <div className="stack compact">
                <div className="eyebrow">Repeating</div>
                {repeated.length ? (
                  repeated.map(([title, count]) => (
                    <div className="item-card day-result" key={`${title}-${count}`}>
                      <div className="item-title-row">
                        <h3>{title}</h3>
                        <span className="chip small">{count}</span>
                      </div>
                      <div className="dialog-actions">
                        <button
                          className="button ghost small"
                          onClick={() => setSearch(title)}
                          type="button"
                        >
                          Show matches
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState>No repeated open loops right now.</EmptyState>
                )}
              </div>
              <div className="stack compact">
                <div className="eyebrow">Overdue</div>
                {overdue.length ? (
                  overdue.map((item) => (
                    <ItemCard
                      item={item}
                      key={item.id}
                      meta={itemMeta(item, currentDate, item.attachments)}
                      onOpen={() => onOpenItem(item.id)}
                    />
                  ))
                ) : (
                  <EmptyState>Nothing overdue.</EmptyState>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>Search and list surfaces stay up front. Open this only when you need a wider trail.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
