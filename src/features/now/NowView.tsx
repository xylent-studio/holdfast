import { useMemo } from 'react';

import type { DateKey } from '@/domain/dates';
import { todayDateKey } from '@/domain/dates';
import {
  carrySuggestions,
  focusedListsForDay,
  getFocusItems,
  getQueueItemsForToday,
  itemMeta,
  listItemsForNow,
  listsForNow,
  overdueItems,
  overdueLists,
} from '@/domain/logic/selectors';
import {
  moveItemToNow,
  setItemFocus,
  toggleTaskDone,
  updateListItem,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { ActiveListCard } from '@/features/lists/ActiveListCard';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

interface NowViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  onOpenList: (listId: string, highlightListItemId?: string | null) => void;
  snapshot: HoldfastSnapshot;
}

export function NowView({
  currentDate,
  onOpenItem,
  onOpenList,
  snapshot,
}: NowViewProps) {
  const isToday = currentDate === todayDateKey();
  const focusItems = useMemo(
    () => getFocusItems(snapshot.currentDay, snapshot.items),
    [snapshot.currentDay, snapshot.items],
  );
  const focusLists = useMemo(
    () => focusedListsForDay(snapshot.currentDay, snapshot.lists),
    [snapshot.currentDay, snapshot.lists],
  );
  const queueItems = useMemo(
    () =>
      getQueueItemsForToday(snapshot.currentDay, snapshot.items, currentDate),
    [currentDate, snapshot.currentDay, snapshot.items],
  );
  const todayNotes = queueItems.filter((item) => item.kind === 'note');
  const todayTasks = queueItems.filter((item) => item.kind === 'task');
  const activeLists = useMemo(
    () => {
      const focusedListIds = new Set(focusLists.map((list) => list.id));
      return listsForNow(snapshot.lists, currentDate).filter(
        (list) => !focusedListIds.has(list.id),
      );
    },
    [currentDate, focusLists, snapshot.lists],
  );
  const listItems = useMemo(
    () => listItemsForNow(snapshot.listItems, currentDate),
    [currentDate, snapshot.listItems],
  );
  const carry = carrySuggestions(snapshot.dailyRecords, currentDate);
  const overdueListEntries = useMemo(
    () => overdueLists(snapshot.lists, currentDate),
    [currentDate, snapshot.lists],
  );
  const overdueItemEntries = useMemo(
    () => overdueItems(snapshot.items, currentDate),
    [currentDate, snapshot.items],
  );

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <div>
            <div className="eyebrow">Command view</div>
            <h1>Now</h1>
            <p>What matters now, without extra ceremony.</p>
          </div>
        </div>
        {carry.length ? (
          <div className="field-stack">
            <span>From yesterday</span>
            <div className="chip-row">
              {carry.map((entry) => (
                <span className="chip active" key={`${entry.type}-${entry.text}`}>
                  Next start | {entry.text}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Focus</h2>
          <p>What deserves extra attention.</p>
        </div>
        {focusItems.length || focusLists.length ? (
          <div className="stack compact">
            {focusItems.length ? (
              <div className="item-list">
                {focusItems.map((item) => (
                  <ItemCard
                    focus
                    item={item}
                    key={item.id}
                    meta={itemMeta(item, currentDate, item.attachments)}
                    onOpen={() => onOpenItem(item.id)}
                    onPrimaryAction={() =>
                      void setItemFocus(currentDate, item.id, false)
                    }
                    onToggleDone={
                      item.kind === 'task'
                        ? () => void toggleTaskDone(item.id, currentDate)
                        : undefined
                    }
                    primaryActionLabel="Remove focus"
                  />
                ))}
              </div>
            ) : null}
            {focusLists.length ? (
              <div className="stack compact">
                {focusLists.map((list) => (
                  <ActiveListCard
                    currentDate={currentDate}
                    isFocused
                    key={list.id}
                    list={list}
                    listItems={snapshot.listItems}
                    onOpenList={(listId) => onOpenList(listId)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState>Nothing in focus yet.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>In play</h2>
          <p>Everything active for this day.</p>
        </div>
        {todayNotes.length ? (
          <div className="item-list spaced">
            {todayNotes.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
                onPrimaryAction={() => void setItemFocus(currentDate, item.id, true)}
                primaryActionLabel={isToday ? 'Focus now' : 'Focus for this day'}
              />
            ))}
          </div>
        ) : null}
        {todayTasks.length ? (
          <div className="item-list">
            {todayTasks.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
                onPrimaryAction={() => void setItemFocus(currentDate, item.id, true)}
                onToggleDone={() => void toggleTaskDone(item.id, currentDate)}
                primaryActionLabel={isToday ? 'Focus now' : 'Focus for this day'}
              />
            ))}
          </div>
        ) : todayNotes.length ? null : (
          <EmptyState>Nothing in play yet.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Lists in play</h2>
          <p>Whole lists you brought into this day.</p>
        </div>
        {activeLists.length ? (
          <div className="stack compact">
            {activeLists.map((list) => (
              <ActiveListCard
                currentDate={currentDate}
                key={list.id}
                list={list}
                listItems={snapshot.listItems}
                onOpenList={(listId) => onOpenList(listId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState>No whole lists in play.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>From lists</h2>
          <p>List items you pulled into Now without creating duplicate tasks.</p>
        </div>
        {listItems.length ? (
          <div className="item-list">
            {listItems.map((item) => {
              const list = snapshot.lists.find((entry) => entry.id === item.listId);
              return (
                <div className="item-card day-result" key={item.id}>
                  <div className="eyebrow">
                    {list ? `List | ${list.title}` : 'List item'}
                  </div>
                  <div className="item-title-row">
                    <h3>{item.title}</h3>
                    <span className="chip small">In Now</span>
                  </div>
                  {item.body.trim() ? <p>{item.body}</p> : null}
                  <div className="dialog-actions">
                    <button
                      className="button ghost small"
                      onClick={() => void updateListItem(item.id, { nowDate: null })}
                      type="button"
                    >
                      Remove from Now
                    </button>
                    {list ? (
                      <button
                        className="button ghost small"
                        onClick={() => onOpenList(list.id, item.id)}
                        type="button"
                      >
                        Open list
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>No list items in Now.</EmptyState>
        )}
      </Panel>

      {overdueListEntries.length || overdueItemEntries.length ? (
        <Panel>
          <div className="panel-header">
            <h2>Overdue</h2>
            <p>Still open from before this date.</p>
          </div>
          <div className="stack compact">
            {overdueListEntries.map((list) => (
              <ActiveListCard
                currentDate={currentDate}
                key={list.id}
                list={list}
                listItems={snapshot.listItems}
                onOpenList={(listId) => onOpenList(listId)}
              />
            ))}
            {overdueItemEntries.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
                onPrimaryAction={() => void moveItemToNow(item.id, currentDate)}
                onToggleDone={
                  item.kind === 'task'
                    ? () => void toggleTaskDone(item.id, currentDate)
                    : undefined
                }
                primaryActionLabel="Move to Now"
              />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
