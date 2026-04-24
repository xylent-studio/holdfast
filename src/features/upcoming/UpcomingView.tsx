import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { DateKey } from '@/domain/dates';
import { parseUpcomingSection } from '@/domain/logic/capture';
import {
  groupScheduledItems,
  itemMeta,
  scheduledLists,
  scheduledUpcomingItems,
  undatedUpcomingItems,
  waitingItems,
} from '@/domain/logic/selectors';
import { toggleTaskDone, type HoldfastSnapshot } from '@/storage/local/api';
import { ActiveListCard } from '@/features/lists/ActiveListCard';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

interface UpcomingViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  onOpenList: (listId: string, highlightListItemId?: string | null) => void;
  snapshot: HoldfastSnapshot;
}

export function UpcomingView({
  currentDate,
  onOpenItem,
  onOpenList,
  snapshot,
}: UpcomingViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseUpcomingSection(searchParams.get('section'));
  const scheduled = scheduledUpcomingItems(snapshot.items, currentDate);
  const scheduledWholeLists = scheduledLists(snapshot.lists, currentDate);
  const undated = undatedUpcomingItems(snapshot.items);
  const waiting = waitingItems(snapshot.items);
  const scheduledGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        date: string;
        items: typeof scheduled;
        lists: typeof scheduledWholeLists;
      }
    >();

    for (const group of groupScheduledItems(scheduled)) {
      groups.set(group.date, {
        date: group.date,
        items: group.items,
        lists: [],
      });
    }

    for (const list of scheduledWholeLists) {
      const key = list.scheduledDate ?? 'unscheduled';
      const current = groups.get(key) ?? { date: key, items: [], lists: [] };
      current.lists.push(list);
      groups.set(key, current);
    }

    return [...groups.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  }, [scheduled, scheduledWholeLists]);

  const handleFilterChange = (nextFilter: 'scheduled' | 'undated' | 'waiting') => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('section', nextFilter);
    setSearchParams(nextSearchParams);
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <div>
            <h1>Upcoming</h1>
            <p>
              What is scheduled, kept undated, or waiting on people, systems, or
              events.
            </p>
          </div>
        </div>
        <div className="chip-row">
          <button
            className={`chip ${filter === 'scheduled' ? 'active' : ''}`}
            onClick={() => handleFilterChange('scheduled')}
            type="button"
          >
            Scheduled {scheduled.length || scheduledWholeLists.length ? `(${scheduled.length + scheduledWholeLists.length})` : ''}
          </button>
          <button
            className={`chip ${filter === 'undated' ? 'active' : ''}`}
            onClick={() => handleFilterChange('undated')}
            type="button"
          >
            Undated {undated.length ? `(${undated.length})` : ''}
          </button>
          <button
            className={`chip ${filter === 'waiting' ? 'active' : ''}`}
            onClick={() => handleFilterChange('waiting')}
            type="button"
          >
            Waiting on {waiting.length ? `(${waiting.length})` : ''}
          </button>
        </div>
        {filter === 'scheduled' ? (
          scheduledGroups.length ? (
            <div className="stack">
              {scheduledGroups.map((group) => (
                <div className="stack compact" key={group.date}>
                  <div className="eyebrow">{group.date}</div>
                  {group.lists.length ? (
                    <div className="stack compact">
                      {group.lists.map((list) => (
                        <ActiveListCard
                          currentDate={currentDate}
                          key={list.id}
                          list={list}
                          listItems={snapshot.listItems}
                          onOpenList={(listId) => onOpenList(listId)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {group.items.length ? (
                    <div className="item-list">
                      {group.items.map((item) => (
                        <ItemCard
                          item={item}
                          key={item.id}
                          meta={itemMeta(item, currentDate, item.attachments)}
                          onOpen={() => onOpenItem(item.id)}
                          onToggleDone={
                            item.kind === 'task'
                              ? () => void toggleTaskDone(item.id, currentDate)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Nothing scheduled for this view.</EmptyState>
          )
        ) : null}
        {filter === 'undated' ? (
          undated.length ? (
            <div className="item-list">
              {undated.map((item) => (
                <ItemCard
                  item={item}
                  key={item.id}
                  meta={itemMeta(item, currentDate, item.attachments)}
                  onOpen={() => onOpenItem(item.id)}
                  onToggleDone={
                    item.kind === 'task'
                      ? () => void toggleTaskDone(item.id, currentDate)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState>Nothing is being kept undated right now.</EmptyState>
          )
        ) : null}
        {filter === 'waiting' ? (
          waiting.length ? (
            <div className="item-list">
              {waiting.map((item) => (
                <ItemCard
                  item={item}
                  key={item.id}
                  meta={itemMeta(item, currentDate, item.attachments)}
                  onOpen={() => onOpenItem(item.id)}
                  onToggleDone={
                    item.kind === 'task'
                      ? () => void toggleTaskDone(item.id, currentDate)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState>Nothing is blocked or waiting right now.</EmptyState>
          )
        ) : null}
      </Panel>
    </div>
  );
}
