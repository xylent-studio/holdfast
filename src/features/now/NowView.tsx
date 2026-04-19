import { useMemo, useState } from 'react';

import { READINESS_CHECKS } from '@/domain/constants';
import { todayDateKey, type DateKey } from '@/domain/dates';
import { itemMeta, carrySuggestions, getFocusItems, getQueueItemsForToday, itemsForToday, nextScheduledItems, overdueItems } from '@/domain/logic/selectors';
import { seedLaunchFromYesterday, startDay, toggleFocus, toggleReadiness, toggleTaskDone } from '@/storage/local/api';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';
import { StatCard } from '@/shared/ui/StatCard';

import { FinishDayDialog } from './FinishDayDialog';

interface NowViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function NowView({ currentDate, onOpenItem, snapshot }: NowViewProps) {
  const [closeDayOpen, setCloseDayOpen] = useState(false);
  const [showReadiness, setShowReadiness] = useState(true);
  const moveToCurrentDayLabel = currentDate === todayDateKey() ? 'Move to today' : 'Move to Now';

  const focusItems = useMemo(
    () => getFocusItems(snapshot.currentDay, snapshot.items),
    [snapshot.currentDay, snapshot.items],
  );
  const queueItems = useMemo(
    () => getQueueItemsForToday(snapshot.currentDay, snapshot.items, currentDate),
    [currentDate, snapshot.currentDay, snapshot.items],
  );
  const todayNotes = queueItems.filter((item) => item.kind === 'note');
  const todayTasks = queueItems.filter((item) => item.kind === 'task');
  const readinessCount = Object.values(snapshot.currentDay.readiness).filter(Boolean).length;
  const readinessComplete = readinessCount === READINESS_CHECKS.length;
  const pendingRoutineCount = snapshot.routines.filter(
    (routine) =>
      routine.active &&
      routine.weekdays.includes(new Date(`${currentDate}T00:00:00`).getDay()) &&
      !snapshot.currentDay.seededRoutineIds.includes(routine.id),
  ).length;
  const carry = carrySuggestions(snapshot.dailyRecords, currentDate);
  const overdue = overdueItems(snapshot.items, currentDate);
  const nextUp = nextScheduledItems(snapshot.items, currentDate);

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <div className="eyebrow">Command view</div>
            <h1>Now</h1>
            <p>What matters for this day, without the noise.</p>
          </div>
          <div className="button-row">
            <button className="button accent" onClick={() => void startDay(currentDate)} type="button">
              {!snapshot.currentDay.startedAt
                ? 'Start day'
                : pendingRoutineCount
                  ? `Add ${pendingRoutineCount} routine${pendingRoutineCount === 1 ? '' : 's'}`
                  : 'Day started'}
            </button>
            <button className="button ghost" onClick={() => setCloseDayOpen(true)} type="button">
              Finish day
            </button>
          </div>
        </div>
        <div className="grid two">
          <StatCard detail="What deserves extra attention right now" label="Focus" value={focusItems.length} />
          <StatCard detail="Open items in play for this date" label="In play" value={itemsForToday(snapshot.items, currentDate).length} />
        </div>
        {carry.length ? (
          <div className="field-stack">
            <span>From yesterday</span>
            <div className="chip-row">
              {carry.map((entry) => (
                <span className={`chip ${entry.type === 'seed' ? 'active' : ''}`} key={`${entry.type}-${entry.text}`}>
                  {entry.text}
                </span>
              ))}
              {carry.some((entry) => entry.type === 'seed') ? (
                <button className="button ghost small" onClick={() => void seedLaunchFromYesterday(currentDate)} type="button">
                  Use here
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel>
        <div className="panel-header split">
          <div>
            <h2>Readiness</h2>
            <p>Handle the platform, then move on.</p>
          </div>
          {readinessComplete ? (
            <button className="button ghost small" onClick={() => setShowReadiness((value) => !value)} type="button">
              {showReadiness ? 'Hide checklist' : 'Show checklist'}
            </button>
          ) : null}
        </div>
        {showReadiness || !readinessComplete ? (
          <div className="grid two">
            {READINESS_CHECKS.map((entry) => (
              <button
                className={`toggle ${snapshot.currentDay.readiness[entry.key] ? 'active' : ''}`}
                key={entry.key}
                onClick={() => void toggleReadiness(currentDate, entry.key)}
                type="button"
              >
                <span>{entry.label}</span>
                <span>{snapshot.currentDay.readiness[entry.key] ? 'Done' : 'Open'}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="chip-row">
            <span className="chip active">Morning check done</span>
          </div>
        )}
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
                onPrimaryAction={() => void toggleFocus(currentDate, item.id)}
                onToggleDone={item.kind === 'task' ? () => void toggleTaskDone(item.id, currentDate) : undefined}
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
                onPrimaryAction={() => void toggleFocus(currentDate, item.id)}
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
                onPrimaryAction={() => void toggleFocus(currentDate, item.id)}
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
          <h2>Overdue</h2>
          <p>Still open from before this date.</p>
        </div>
        {overdue.length ? (
          <div className="item-list">
            {overdue.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
                onPrimaryAction={() => void toggleFocus(currentDate, item.id)}
                onToggleDone={item.kind === 'task' ? () => void toggleTaskDone(item.id, currentDate) : undefined}
                primaryActionLabel={moveToCurrentDayLabel}
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing overdue.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Next up</h2>
          <p>Scheduled after this date, without flooding this day.</p>
        </div>
        {nextUp.length ? (
          <div className="item-list">
            {nextUp.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing scheduled after this date right now.</EmptyState>
        )}
      </Panel>

      <FinishDayDialog
        currentDate={currentDate}
        day={snapshot.currentDay}
        isOpen={closeDayOpen}
        key={`${snapshot.currentDay.date}-${snapshot.currentDay.updatedAt}`}
        onClose={() => setCloseDayOpen(false)}
      />
    </div>
  );
}
