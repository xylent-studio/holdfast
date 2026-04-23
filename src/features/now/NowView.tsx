import { useMemo } from 'react';
import type { DateKey } from '@/domain/dates';
import {
  carrySuggestions,
  getFocusItems,
  getQueueItemsForToday,
  itemMeta,
  listItemsForNow,
  overdueItems,
} from '@/domain/logic/selectors';
import {
  moveItemToNow,
  setItemFocus,
  toggleTaskDone,
  updateListItem,
} from '@/storage/local/api';
import type { HoldfastSnapshot } from '@/storage/local/api';
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
  const focusItems = useMemo(
    () => getFocusItems(snapshot.currentDay, snapshot.items),
    [snapshot.currentDay, snapshot.items],
  );
  const queueItems = useMemo(
    () =>
      getQueueItemsForToday(snapshot.currentDay, snapshot.items, currentDate),
    [currentDate, snapshot.currentDay, snapshot.items],
  );
  const todayNotes = queueItems.filter((item) => item.kind === 'note');
  const todayTasks = queueItems.filter((item) => item.kind === 'task');
  const listItems = useMemo(
    () => listItemsForNow(snapshot.listItems, currentDate),
    [currentDate, snapshot.listItems],
  );
  const carry = carrySuggestions(snapshot.dailyRecords, currentDate);
  const overdue = overdueItems(snapshot.items, currentDate);

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
        {focusItems.length ? (
          <div className="item-list">
            {focusItems.map((item) => (
              <ItemCard
                focus
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
                onPrimaryAction={() => void setItemFocus(currentDate, item.id, false)}
                onToggleDone={
                  item.kind === 'task'
                    ? () => void toggleTaskDone(item.id, currentDate)
                    : undefined
                }
                primaryActionLabel="Remove focus"
              />
            ))}
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
                primaryActionLabel="Add focus"
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
                primaryActionLabel="Add focus"
              />
            ))}
          </div>
        ) : todayNotes.length ? null : (
          <EmptyState>Nothing in play yet.</EmptyState>
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

      {overdue.length ? (
        <Panel>
        <div className="panel-header">
          <h2>Overdue</h2>
          <p>Still open from before this date.</p>
        </div>
          <div className="item-list">
            {overdue.map((item) => (
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
