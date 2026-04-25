import { useMemo, useState } from 'react';

import { LIST_KIND_LABELS } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import type { ReviewMatchReason } from '@/domain/logic/selectors';
import type { ItemSurfaceContext } from '@/domain/logic/surface-actions';
import {
  conflictedItems,
  conflictedListItems,
  conflictedLists,
  itemMeta,
  overdueItems,
  recentDaySummaries,
  repeatedOpenTitles,
  searchWorkspace,
} from '@/domain/logic/selectors';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

interface ReviewViewProps {
  currentDate: DateKey;
  onJumpToDate: (date: DateKey) => void;
  onOpenItem: (itemId: string, origin: ItemSurfaceContext) => void;
  onOpenList: (listId: string, highlightListItemId?: string | null) => void;
  snapshot: HoldfastSnapshot;
}

function matchReasonLabel(reason: ReviewMatchReason): string {
  switch (reason.field) {
    case 'title':
      return 'Matched in title';
    case 'notes':
      return 'Matched in notes';
    case 'source':
      return 'Matched in source text';
    case 'attachment':
      return `Attachment | ${reason.value ?? 'File'}`;
    case 'status':
      return `Matched in ${reason.value ?? 'status'}`;
    case 'listTitle':
      return `List | ${reason.value ?? 'Matched list'}`;
    case 'dayNote':
      return 'Matched in day notes';
  }
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

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <h1>Review</h1>
          <p>Find saved things again, understand why they matched, and jump back into the right place.</p>
        </div>
        <label className="field-stack">
          <span>Search</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search captures, attachments, list items, list titles, and day notes"
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
                      meta={[
                        ...itemMeta(
                          result.item,
                          currentDate,
                          result.item.attachments,
                        ),
                        ...result.matchedOn.map((reason) =>
                          matchReasonLabel(reason),
                        ),
                      ]}
                      onOpen={() => onOpenItem(result.item.id, { route: 'review' })}
                    />
                  );
                }

                if (result.type === 'day') {
                  return (
                    <div className="item-card day-result" key={`day-${result.date}`}>
                      <div className="eyebrow">{result.date}</div>
                      <div className="chip-row">
                        {result.matchedOn.map((reason) => (
                          <span className="chip small" key={`${result.date}-${reason.field}`}>
                            {matchReasonLabel(reason)}
                          </span>
                        ))}
                      </div>
                      <p>
                        {[result.dailyRecord.launchNote, result.dailyRecord.closeWin, result.dailyRecord.closeCarry, result.dailyRecord.closeSeed, result.dailyRecord.closeNote]
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
                        {LIST_KIND_LABELS[result.list.kind]} list
                        {result.list.pinned ? ' | pinned' : ''}
                      </div>
                      <div className="item-title-row">
                        <h3>{result.list.title}</h3>
                        <div className="chip-row">
                          <span className="chip small">{result.openCount} current</span>
                          {result.doneCount ? (
                            <span className="chip small">{result.doneCount} done</span>
                          ) : null}
                          {result.list.archivedAt ? (
                            <span className="chip small">Archived run</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="chip-row">
                        {result.matchedOn.map((reason) => (
                          <span className="chip small" key={`${result.list.id}-${reason.field}`}>
                            {matchReasonLabel(reason)}
                          </span>
                        ))}
                      </div>
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
                      <div className="chip-row">
                        <span className="chip small">{result.listItem.status}</span>
                        {result.listItem.nowDate ? (
                          <span className="chip small">In Now</span>
                        ) : null}
                        {result.list.archivedAt ? (
                          <span className="chip small">Archived run</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="chip-row">
                      {result.matchedOn.map((reason) => (
                        <span
                          className="chip small"
                          key={`${result.listItem.id}-${reason.field}-${reason.value ?? ''}`}
                        >
                          {matchReasonLabel(reason)}
                        </span>
                      ))}
                    </div>
                    {result.listItem.body.trim() ? <p>{result.listItem.body}</p> : null}
                    <div className="dialog-actions">
                      <button
                        className="button ghost small"
                        onClick={() => onOpenList(result.list.id, result.listItem.id)}
                        type="button"
                      >
                        Open matching item
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
            Search captures, attachments, list items, list titles, or day notes.
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
                onOpen={() => onOpenItem(item.id, { route: 'review' })}
              />
            ))}
            {conflictLists.map((list) => (
              <div className="item-card day-result" key={`conflict-list-${list.id}`}>
                <div className="eyebrow">{LIST_KIND_LABELS[list.kind]} list</div>
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
                      onClick={() => onOpenList(list.id, listItem.id)}
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
                      onOpen={() => onOpenItem(item.id, { route: 'review' })}
                    />
                  ))
                ) : (
                  <EmptyState>Nothing overdue.</EmptyState>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>Search stays primary. Open this only when you need a wider trail.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
