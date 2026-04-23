import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { DateKey } from '@/domain/dates';
import { parseUpcomingSection } from '@/domain/logic/capture';
import {
  groupScheduledItems,
  itemMeta,
  scheduledUpcomingItems,
  undatedUpcomingItems,
  waitingItems,
} from '@/domain/logic/selectors';
import { toggleTaskDone, type HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

interface UpcomingViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function UpcomingView({ currentDate, onOpenItem, snapshot }: UpcomingViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseUpcomingSection(searchParams.get('section'));
  const scheduled = scheduledUpcomingItems(snapshot.items, currentDate);
  const undated = undatedUpcomingItems(snapshot.items);
  const waiting = waitingItems(snapshot.items);
  const scheduledGroups = useMemo(
    () => groupScheduledItems(scheduled),
    [scheduled],
  );

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
            <p>What is scheduled, kept undated, or waiting on people, systems, or events.</p>
          </div>
        </div>
        <div className="chip-row">
          <button className={`chip ${filter === 'scheduled' ? 'active' : ''}`} onClick={() => handleFilterChange('scheduled')} type="button">
            Scheduled {scheduled.length ? `(${scheduled.length})` : ''}
          </button>
          <button className={`chip ${filter === 'undated' ? 'active' : ''}`} onClick={() => handleFilterChange('undated')} type="button">
            Undated {undated.length ? `(${undated.length})` : ''}
          </button>
          <button className={`chip ${filter === 'waiting' ? 'active' : ''}`} onClick={() => handleFilterChange('waiting')} type="button">
            Waiting on {waiting.length ? `(${waiting.length})` : ''}
          </button>
        </div>
        {filter === 'scheduled' ? (
          scheduledGroups.length ? (
            <div className="stack">
              {scheduledGroups.map((group) => (
                <div className="stack compact" key={group.date}>
                  <div className="eyebrow">{group.date}</div>
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
