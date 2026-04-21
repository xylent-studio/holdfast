import { useState } from 'react';

import type { DateKey } from '@/domain/dates';
import { inboxItems, itemMeta } from '@/domain/logic/selectors';
import { toggleFocus, toggleTaskDone } from '@/storage/local/api';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';

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
  const [filter, setFilter] = useState<'unsorted' | 'open' | 'archived'>(
    'unsorted',
  );
  const items = inboxItems(snapshot.items, filter);
  const focusIds = new Set(snapshot.currentDay.focusItemIds);

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
              ['open', 'All open'],
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
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
                onPrimaryAction={
                  item.kind === 'capture'
                    ? () => onOpenItem(item.id)
                    : () => void toggleFocus(currentDate, item.id)
                }
                onToggleDone={
                  item.kind === 'task'
                    ? () => void toggleTaskDone(item.id, currentDate)
                    : undefined
                }
                primaryActionLabel={
                  item.kind === 'capture'
                    ? 'Shape it'
                    : item.status === 'today'
                      ? focusIds.has(item.id)
                        ? 'Remove focus'
                        : 'Add focus'
                      : 'Move to Now'
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing here.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
