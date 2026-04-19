import { useState } from 'react';

import type { DateKey } from '@/domain/dates';
import { groupScheduledItems, itemMeta, queuedUpcomingItems, scheduledUpcomingItems, waitingItems } from '@/domain/logic/selectors';
import type { PlanSpan } from '@/domain/logic/selectors';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

interface UpcomingViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function UpcomingView({ currentDate, onOpenItem, snapshot }: UpcomingViewProps) {
  const [filter, setFilter] = useState<'planned' | 'queue' | 'waiting'>('planned');
  const [planSpan, setPlanSpan] = useState<PlanSpan>('week');
  const planned = scheduledUpcomingItems(snapshot.items, currentDate, planSpan);
  const queue = queuedUpcomingItems(snapshot.items);
  const waiting = waitingItems(snapshot.items);

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <h1>Upcoming</h1>
            <p>What is planned, queued, or waiting on someone else.</p>
          </div>
          {filter === 'planned' ? (
            <div className="chip-row">
              {(['day', 'week', 'month'] as const).map((span) => (
                <button className={`chip ${planSpan === span ? 'active' : ''}`} key={span} onClick={() => setPlanSpan(span)} type="button">
                  {span[0].toUpperCase()}
                  {span.slice(1)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="chip-row">
          <button className={`chip ${filter === 'planned' ? 'active' : ''}`} onClick={() => setFilter('planned')} type="button">
            Planned {planned.length ? `(${planned.length})` : ''}
          </button>
          <button className={`chip ${filter === 'queue' ? 'active' : ''}`} onClick={() => setFilter('queue')} type="button">
            Queue {queue.length ? `(${queue.length})` : ''}
          </button>
          <button className={`chip ${filter === 'waiting' ? 'active' : ''}`} onClick={() => setFilter('waiting')} type="button">
            Waiting on {waiting.length ? `(${waiting.length})` : ''}
          </button>
        </div>
        {filter === 'planned' ? (
          groupScheduledItems(planned).length ? (
            <div className="stack">
              {groupScheduledItems(planned).map((group) => (
                <div className="stack compact" key={group.date}>
                  <div className="eyebrow">{group.date}</div>
                  <div className="item-list">
                    {group.items.map((item) => (
                      <ItemCard
                        item={item}
                        key={item.id}
                        meta={itemMeta(item, currentDate, item.attachments)}
                        onOpen={() => onOpenItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Nothing planned for this view.</EmptyState>
          )
        ) : null}
        {filter === 'queue' ? (
          queue.length ? (
            <div className="item-list">
              {queue.map((item) => (
                <ItemCard
                  item={item}
                  key={item.id}
                  meta={itemMeta(item, currentDate, item.attachments)}
                  onOpen={() => onOpenItem(item.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState>Nothing parked in the queue right now.</EmptyState>
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
