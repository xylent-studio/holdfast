import { useMemo, useState } from 'react';

import type { DateKey } from '@/domain/dates';
import {
  itemMeta,
  overdueItems,
  recentDaySummaries,
  repeatedOpenTitles,
  reviewListSummaries,
  searchWorkspace,
} from '@/domain/logic/selectors';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';
import { StatCard } from '@/shared/ui/StatCard';

interface ReviewViewProps {
  currentDate: DateKey;
  onJumpToDate: (date: DateKey) => void;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ReviewView({
  currentDate,
  onJumpToDate,
  onOpenItem,
  snapshot,
}: ReviewViewProps) {
  const [search, setSearch] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const repeated = useMemo(
    () => repeatedOpenTitles(snapshot.items),
    [snapshot.items],
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
  const selectedListSummary = selectedListId
    ? listSummaries.find((entry) => entry.list.id === selectedListId) ?? null
    : null;
  const selectedListItems = useMemo(
    () =>
      selectedListId
        ? snapshot.listItems
            .filter(
              (entry) =>
                entry.listId === selectedListId &&
                !entry.deletedAt &&
                entry.status !== 'archived',
            )
            .sort((left, right) => left.position - right.position)
        : [],
    [selectedListId, snapshot.listItems],
  );

  const showList = (listId: string): void => {
    setSelectedListId(listId);
    setSearch('');
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <h1>Review</h1>
            <p>
              Find saved things again, catch repeats, and pull the right thing
              back into view.
            </p>
          </div>
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
        {selectedListSummary ? (
          <div className="dialog-actions">
            <span className="chip active">
              Showing list | {selectedListSummary.list.title}
            </span>
            <button
              className="button ghost small"
              onClick={() => setSelectedListId(null)}
              type="button"
            >
              Clear list
            </button>
          </div>
        ) : null}
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
                          : 'Ready to refind without making lists a second app.'}
                      </p>
                      <div className="dialog-actions">
                        <button
                          className="button ghost small"
                          onClick={() => showList(result.list.id)}
                          type="button"
                        >
                          Show list
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
                        onClick={() => showList(result.list.id)}
                        type="button"
                      >
                        Show list
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

      <Panel>
        <div className="panel-header">
          <h2>Needs attention</h2>
          <p>The shortest path to what may deserve action next.</p>
        </div>
        <div className="grid three">
          <StatCard
            detail="Items dated before today"
            label="Overdue"
            value={overdue.length}
          />
          <StatCard
            detail="Open loops showing up more than once"
            label="Repeating"
            value={repeated.length}
          />
          <StatCard
            detail="Pinned or active lists in view"
            label="Lists"
            value={listSummaries.length}
          />
        </div>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Lists worth revisiting</h2>
          <p>List surfaces you can refind here without adding another nav tab.</p>
        </div>
        {selectedListSummary ? (
          <div className="stack compact">
            <div className="item-card day-result">
              <div className="eyebrow">
                {selectedListSummary.list.kind} list
                {selectedListSummary.list.pinned ? ' | pinned' : ''}
              </div>
              <div className="item-title-row">
                <h3>{selectedListSummary.list.title}</h3>
                <span className="chip small">
                  {selectedListSummary.openCount} open
                </span>
              </div>
              <p>
                {selectedListSummary.doneCount
                  ? `${selectedListSummary.doneCount} done item${
                      selectedListSummary.doneCount === 1 ? '' : 's'
                    } kept in history.`
                  : 'No done history in this list yet.'}
              </p>
              <div className="dialog-actions">
                <button
                  className="button ghost small"
                  onClick={() => setSelectedListId(null)}
                  type="button"
                >
                  Back to lists
                </button>
              </div>
            </div>
            {selectedListItems.length ? (
              <div className="item-list">
                {selectedListItems.map((entry) => (
                  <div className="item-card day-result" key={entry.id}>
                    <div className="eyebrow">List item</div>
                    <div className="item-title-row">
                      <h3>{entry.title}</h3>
                      <span className="chip small">{entry.status}</span>
                    </div>
                    {entry.body.trim() ? (
                      <p>{entry.body}</p>
                    ) : (
                      <p>Still attached to this list surface.</p>
                    )}
                    <div className="dialog-actions">
                      <button
                        className="button ghost small"
                        onClick={() => setSearch(entry.title)}
                        type="button"
                      >
                        Search matches
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No live list items here right now.</EmptyState>
            )}
          </div>
        ) : listSummaries.length ? (
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
                    onClick={() => showList(entry.list.id)}
                    type="button"
                  >
                    Show list
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
        <div className="panel-header">
          <h2>Recent days</h2>
          <p>A short read on what stayed alive, not how well you performed.</p>
        </div>
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
              <div className="meta-row">
                <span className="meta-chip">
                  Carry | {day.carryCount ? `${day.carryCount} kept alive` : '--'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-chip">
                  Closeout | {day.closed ? 'yes' : 'no'}
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
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Repeating</h2>
          <p>Things that keep staying open and probably deserve structure.</p>
        </div>
        {repeated.length ? (
          <div className="item-list">
            {repeated.map(([title, count]) => (
              <div className="item-card day-result" key={`${title}-${count}`}>
                <div className="item-title-row">
                  <h3>{title}</h3>
                  <span className="chip small">{count}</span>
                </div>
                <p>
                  This title is still open across multiple items. Consider
                  making it a routine or clarifying scope.
                </p>
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
            ))}
          </div>
        ) : (
          <EmptyState>No repeated open loops right now.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Overdue</h2>
          <p>Anything with a date before today.</p>
        </div>
        {overdue.length ? (
          <div className="item-list">
            {overdue.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing overdue.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
