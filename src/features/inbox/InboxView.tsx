import { useState } from 'react';

import { addDays } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import { inboxItems, itemMeta } from '@/domain/logic/selectors';
import {
  inboxPlacementActionSpecs,
  type ItemSurfaceContext,
  type SurfaceActionSpec,
} from '@/domain/logic/surface-actions';
import {
  moveItemToList,
  moveItemToNewList,
  saveItem,
  toggleTaskDone,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { ListTargetDialog } from '@/features/lists/ListTargetDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';
import { ScheduleConfirmDialog } from '@/shared/ui/ScheduleConfirmDialog';
import { useCompactLayout } from '@/shared/ui/useCompactLayout';

interface InboxViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string, origin: ItemSurfaceContext) => void;
  snapshot: HoldfastSnapshot;
}

export function InboxView({
  currentDate,
  onOpenItem,
  snapshot,
}: InboxViewProps) {
  const [filter, setFilter] = useState<'unsorted' | 'archived'>('unsorted');
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [listRoutingItemId, setListRoutingItemId] = useState<string | null>(null);
  const items = inboxItems(snapshot.items, filter);
  const scheduleItem = items.find((item) => item.id === scheduleItemId) ?? null;
  const listRoutingItem = items.find((item) => item.id === listRoutingItemId) ?? null;
  const placementActions = inboxPlacementActionSpecs();
  const compactLayout = useCompactLayout();

  const routeItem = async (
    item: (typeof items)[number],
    destination: 'archive' | 'now' | 'scheduled' | 'undated' | 'waiting',
    scheduledDate?: DateKey | null,
    scheduledTime?: string | null,
  ): Promise<void> => {
    if (destination === 'scheduled' && !scheduledDate) {
      setScheduleItemId(item.id);
      return;
    }

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
            ? scheduledDate
            : null,
      scheduledTime: destination === 'scheduled' ? scheduledTime ?? null : null,
    });
  };
  const handlePlacementAction = (
    item: (typeof items)[number],
    action: SurfaceActionSpec,
  ): void => {
    switch (action.id) {
      case 'now':
        void routeItem(item, 'now');
        break;
      case 'scheduled':
        setScheduleItemId(item.id);
        break;
      case 'undated':
        void routeItem(item, 'undated');
        break;
      case 'waiting':
        void routeItem(item, 'waiting');
        break;
      case 'archive':
        void routeItem(item, 'archive');
        break;
      case 'list':
        setListRoutingItemId(item.id);
        break;
    }
  };

  const renderPlacementButton = (
    item: (typeof items)[number],
    action: SurfaceActionSpec,
  ) => (
    <button
      className="chip"
      key={action.id}
      onClick={() => handlePlacementAction(item, action)}
      type="button"
    >
      {action.label}
    </button>
  );

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
                  onOpen={() => onOpenItem(item.id, { route: 'inbox' })}
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
                      {compactLayout ? (
                        <div className="placement-actions-compact">
                          <div className="chip-row">
                            {placementActions
                              .filter((action) => ['now', 'list'].includes(action.id))
                              .map((action) => renderPlacementButton(item, action))}
                          </div>
                          <details className="placement-overflow">
                            <summary className="chip">More places</summary>
                            <div className="chip-row">
                              {placementActions
                                .filter(
                                  (action) => !['now', 'list'].includes(action.id),
                                )
                                .map((action) => renderPlacementButton(item, action))}
                            </div>
                          </details>
                        </div>
                      ) : (
                        <div className="chip-row">
                          {placementActions.map((action) =>
                            renderPlacementButton(item, action),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Nothing here.</EmptyState>
        )}
      </Panel>

      {scheduleItem ? (
        <ScheduleConfirmDialog
          confirmLabel="Schedule"
          defaultDate={addDays(currentDate, 1)}
          description="Pick when this should show up in Upcoming."
          onClose={() => setScheduleItemId(null)}
          onConfirm={async (date, time) => {
            await routeItem(scheduleItem, 'scheduled', date, time);
          }}
          title="Schedule it"
        />
      ) : null}
      {listRoutingItem ? (
        <ListTargetDialog
          confirmExistingLabel="Convert to list item"
          confirmNewLabel="Create list and convert"
          draftText={[listRoutingItem.title, listRoutingItem.body].filter(Boolean).join('\n\n')}
          initialMode={snapshot.lists.some((entry) => !entry.deletedAt && !entry.archivedAt) ? 'existing' : 'new'}
          lists={snapshot.lists}
          onClose={() => setListRoutingItemId(null)}
          onConfirmExisting={async (listId) => {
            await moveItemToList(listRoutingItem.id, listId);
          }}
          onConfirmNew={async ({ kind, title }) => {
            await moveItemToNewList(listRoutingItem.id, {
              title,
              kind,
              lane: listRoutingItem.lane,
            });
          }}
          title="Convert to list item"
        />
      ) : null}
    </div>
  );
}
