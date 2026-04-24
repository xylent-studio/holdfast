import { useEffect, useMemo, useRef, useState } from 'react';

import { LIST_KIND_LABELS } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import { todayDateKey } from '@/domain/dates';
import { activeListItemsForDisplay } from '@/domain/logic/selectors';
import {
  clearListSchedule,
  createTaskFromListItem,
  createListItem,
  deleteListItem,
  finishList,
  moveListToNow,
  promoteListItemToNow,
  reopenAllDoneListItems,
  replaceListItemWithLatestSavedVersion,
  replaceListWithLatestSavedVersion,
  scheduleList,
  setListFocus,
  updateList,
  updateListItem,
  type FinishListAction,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { FinishListDialog } from '@/features/lists/FinishListDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Panel } from '@/shared/ui/Panel';

interface ListViewProps {
  currentDate: DateKey;
  highlightListItemId?: string | null;
  listId: string;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ListView({
  currentDate,
  highlightListItemId = null,
  listId,
  onOpenItem,
  snapshot,
}: ListViewProps) {
  const [draft, setDraft] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [listConflictBusy, setListConflictBusy] = useState(false);
  const [listConflictError, setListConflictError] = useState<string | null>(null);
  const [listItemConflictBusyId, setListItemConflictBusyId] = useState<
    string | null
  >(null);
  const [listItemConflictErrorId, setListItemConflictErrorId] = useState<
    string | null
  >(null);
  const [listItemConflictError, setListItemConflictError] = useState<
    string | null
  >(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const scheduleDateRef = useRef<HTMLInputElement | null>(null);
  const scheduleTimeRef = useRef<HTMLInputElement | null>(null);

  const list = snapshot.lists.find((entry) => entry.id === listId) ?? null;
  const items = useMemo(
    () =>
      snapshot.listItems
        .filter((entry) => entry.listId === listId && !entry.deletedAt)
        .sort((left, right) => left.position - right.position),
    [listId, snapshot.listItems],
  );
  const openItems = items.filter((entry) => entry.status === 'open');
  const doneItems = items.filter((entry) => entry.status === 'done');
  const archivedItems = items.filter((entry) => entry.status === 'archived');
  const activeItems = useMemo(
    () => activeListItemsForDisplay(snapshot.listItems, listId),
    [listId, snapshot.listItems],
  );
  const isToday = currentDate === todayDateKey();
  const isFocused = Boolean(
    list && (snapshot.currentDay.focusListIds ?? []).includes(list.id),
  );
  const isActiveList =
    Boolean(list?.scheduledDate && list.scheduledDate <= currentDate) || isFocused;
  const listDescription = (() => {
    if (!list) {
      return '';
    }

    switch (list.kind) {
      case 'replenishment':
        return 'Bring the whole list into Now when you are actually doing the run.';
      case 'checklist':
        return 'Use the full list in context, cross things off, then choose how the run should finish.';
      case 'reference':
        return 'Keep the list available without pretending it always belongs in command view.';
      case 'project':
      default:
        return 'Use the list as a working surface without turning it into duplicate tasks unless you mean to.';
    }
  })();

  useEffect(() => {
    if (!highlightListItemId) {
      return;
    }

    document
      .querySelector<HTMLElement>(`[data-list-item-id="${highlightListItemId}"]`)
      ?.scrollIntoView({ block: 'center' });
  }, [highlightListItemId]);

  if (!list) {
    return (
      <Panel>
        <div className="panel-header">
          <h1>List not found</h1>
          <p>This list is gone or archived.</p>
        </div>
      </Panel>
    );
  }

  const handleQuickAdd = async (): Promise<void> => {
    if (!draft.trim()) {
      return;
    }

    await createListItem({
      listId,
      title: draft.trim(),
    });
    setDraft('');
  };

  const handleSchedule = async (): Promise<void> => {
    await scheduleList(
      list.id,
      (scheduleDateRef.current?.value || currentDate) as DateKey,
      scheduleTimeRef.current?.value.trim() || null,
    );
  };

  const handleUseLatestSavedList = async (): Promise<void> => {
    setListConflictError(null);
    setListConflictBusy(true);

    try {
      await replaceListWithLatestSavedVersion(list.id);
    } catch (error) {
      setListConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load the latest saved version yet.",
      );
    } finally {
      setListConflictBusy(false);
    }
  };

  const handleKeepLocalList = async (): Promise<void> => {
    setListConflictError(null);
    setListConflictBusy(true);

    try {
      await updateList(list.id, {
        title: list.title,
        kind: list.kind,
        lane: list.lane,
        pinned: list.pinned,
        scheduledDate: list.scheduledDate,
        scheduledTime: list.scheduledTime,
        completedAt: list.completedAt,
        archivedAt: list.archivedAt,
      });
    } catch (error) {
      setListConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save this version yet.",
      );
    } finally {
      setListConflictBusy(false);
    }
  };

  const handleUseLatestSavedListItem = async (
    listItemId: string,
  ): Promise<void> => {
    setListItemConflictError(null);
    setListItemConflictErrorId(null);
    setListItemConflictBusyId(listItemId);

    try {
      await replaceListItemWithLatestSavedVersion(listItemId);
    } catch (error) {
      setListItemConflictErrorId(listItemId);
      setListItemConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load the latest saved version yet.",
      );
    } finally {
      setListItemConflictBusyId(null);
    }
  };

  const handleKeepLocalListItem = async (
    listItemId: string,
  ): Promise<void> => {
    const current = items.find((entry) => entry.id === listItemId);
    if (!current) {
      return;
    }

    setListItemConflictError(null);
    setListItemConflictErrorId(null);
    setListItemConflictBusyId(listItemId);

    try {
      await updateListItem(listItemId, {
        title: current.title,
        body: current.body,
        status: current.status,
        position: current.position,
        sourceItemId: current.sourceItemId,
        nowDate: current.nowDate,
      });
    } catch (error) {
      setListItemConflictErrorId(listItemId);
      setListItemConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save this version yet.",
      );
    } finally {
      setListItemConflictBusyId(null);
    }
  };

  const handleFinish = async (action: FinishListAction): Promise<void> => {
    setFinishError(null);
    setFinishBusy(true);

    try {
      await finishList(list.id, action, currentDate);
      setFinishOpen(false);
      setDoneOpen(false);
    } catch (error) {
      setFinishError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't finish this list yet.",
      );
    } finally {
      setFinishBusy(false);
    }
  };

  const renderListItemCard = (
    entry: (typeof items)[number],
    options?: { activeRun?: boolean },
  ) => {
    const activeRun = options?.activeRun ?? false;
    const sourceItem = entry.sourceItemId
      ? snapshot.items.find((item) => item.id === entry.sourceItemId) ?? null
      : null;
    const isConflict = entry.syncState === 'conflict';
    const conflictBusy = listItemConflictBusyId === entry.id;
    const conflictError =
      listItemConflictErrorId === entry.id ? listItemConflictError : null;

    return (
      <div
        className={`item-card day-result ${
          highlightListItemId === entry.id ? 'focus' : ''
        }${activeRun && entry.status === 'done' ? ' crossed-off' : ''}`}
        data-list-item-id={entry.id}
        key={entry.id}
      >
        <div className="item-title-row">
          <h3>{entry.title}</h3>
          <div className="chip-row">
            {isConflict ? <span className="chip small">Needs attention</span> : null}
            {entry.nowDate ? <span className="chip small">In Now</span> : null}
            {entry.status === 'done' ? (
              <span className="chip small">Crossed off</span>
            ) : null}
            {entry.status === 'archived' ? (
              <span className="chip small">Archived</span>
            ) : null}
          </div>
        </div>
        {entry.body.trim() ? <p>{entry.body}</p> : null}
        {isConflict ? (
          <div className="recovery-note">
            <strong>This list item changed in two places.</strong>
            <p>
              Keep this version if it still matters here, or pull in the latest
              saved version before you keep moving.
            </p>
            <div className="dialog-actions">
              <button
                className="button ghost"
                disabled={conflictBusy}
                onClick={() => void handleKeepLocalListItem(entry.id)}
                type="button"
              >
                Keep this version
              </button>
              <button
                className="button ghost"
                disabled={conflictBusy}
                onClick={() => void handleUseLatestSavedListItem(entry.id)}
                type="button"
              >
                {conflictBusy ? 'Loading...' : 'Use latest saved version'}
              </button>
            </div>
            {conflictError ? (
              <p className="auth-feedback danger">{conflictError}</p>
            ) : null}
          </div>
        ) : null}
        <div className="dialog-actions">
          {entry.status === 'done' ? (
            <button
              className="button ghost small"
              onClick={() => void updateListItem(entry.id, { status: 'open' })}
              type="button"
            >
              Reopen
            </button>
          ) : (
            <button
              className="button ghost small"
              onClick={() => void updateListItem(entry.id, { status: 'done' })}
              type="button"
            >
              {activeRun ? 'Cross off' : 'Done'}
            </button>
          )}
          {entry.status === 'open' && list.kind !== 'reference' ? (
            entry.nowDate ? (
              <button
                className="button ghost small"
                onClick={() => void updateListItem(entry.id, { nowDate: null })}
                type="button"
              >
                Remove from Now
              </button>
            ) : (
              <button
                className="button ghost small"
                onClick={() => void promoteListItemToNow(entry.id, currentDate)}
                type="button"
              >
                Send to Now
              </button>
            )
          ) : null}
          {entry.status === 'open' && list.kind !== 'reference' ? (
            <button
              className="button ghost small"
              onClick={() =>
                void createTaskFromListItem(entry.id, currentDate).then((itemId) => {
                  if (itemId) {
                    onOpenItem(itemId);
                  }
                })
              }
              type="button"
            >
              Create task
            </button>
          ) : null}
          {entry.status === 'done' && list.kind === 'replenishment' ? (
            <button
              className="button ghost small"
              onClick={() =>
                void createListItem({
                  listId: list.id,
                  title: entry.title,
                  body: entry.body,
                  sourceItemId: entry.sourceItemId,
                })
              }
              type="button"
            >
              Add again
            </button>
          ) : null}
          {sourceItem && entry.status !== 'archived' ? (
            <button
              className="button ghost small"
              onClick={() => onOpenItem(sourceItem.id)}
              type="button"
            >
              Open original
            </button>
          ) : null}
          {entry.status !== 'archived' ? (
            <button
              className="button danger small"
              onClick={() => void deleteListItem(entry.id)}
              type="button"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <div className="eyebrow">{LIST_KIND_LABELS[list.kind]} list</div>
            <h1>{list.title}</h1>
            <p>{listDescription}</p>
          </div>
          <div className="chip-row">
            <span className="chip small">{openItems.length} current</span>
            {doneItems.length ? (
              <span className="chip small">{doneItems.length} done</span>
            ) : null}
            {list.scheduledDate ? (
              <span className="chip small">
                {list.scheduledDate > currentDate ? 'Scheduled' : 'In Now'}
              </span>
            ) : null}
            {isFocused ? <span className="chip active">Focus</span> : null}
            {list.syncState === 'conflict' ? (
              <span className="chip small">Needs attention</span>
            ) : null}
            {list.pinned ? <span className="chip active">Pinned</span> : null}
          </div>
        </div>

        <div className="dialog-actions wrap">
          <button
            className="button ghost small"
            onClick={() => void updateList(list.id, { pinned: !list.pinned })}
            type="button"
          >
            {list.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            className="button ghost small"
            onClick={() => void moveListToNow(list.id, currentDate)}
            type="button"
          >
            Bring to Now
          </button>
          <button
            className="button ghost small"
            onClick={() => void setListFocus(currentDate, list.id, true)}
            type="button"
          >
            {isToday ? 'Focus now' : 'Focus for this day'}
          </button>
          {isFocused ? (
            <button
              className="button ghost small"
              onClick={() => void setListFocus(currentDate, list.id, false)}
              type="button"
            >
              Remove focus
            </button>
          ) : null}
          {list.scheduledDate ? (
            <button
              className="button ghost small"
              onClick={() => void clearListSchedule(list.id)}
              type="button"
            >
              {list.scheduledDate > currentDate ? 'Unschedule' : 'Remove from Now'}
            </button>
          ) : null}
          <button
            className="button ghost small"
            onClick={() => {
              setFinishError(null);
              setFinishOpen(true);
            }}
            type="button"
          >
            Finish list
          </button>
        </div>

        <div
          className="inline-form wrap"
          key={`${list.id}:${list.scheduledDate ?? ''}:${list.scheduledTime ?? ''}:${currentDate}`}
        >
          <label className="field-stack grow">
            <span>Schedule for</span>
            <input
              defaultValue={list.scheduledDate ?? currentDate}
              ref={scheduleDateRef}
              type="date"
            />
          </label>
          <label className="field-stack">
            <span>Time</span>
            <input
              defaultValue={list.scheduledTime ?? ''}
              ref={scheduleTimeRef}
              type="time"
            />
          </label>
          <div className="dialog-actions align-end">
            <button className="button ghost small" onClick={() => void handleSchedule()} type="button">
              Schedule
            </button>
          </div>
        </div>

        {list.syncState === 'conflict' ? (
          <div className="recovery-note">
            <strong>This list changed in two places.</strong>
            <p>
              Keep this version if it is still the right one here, or pull in the
              latest saved version before you keep moving.
            </p>
            <div className="dialog-actions">
              <button
                className="button ghost"
                disabled={listConflictBusy}
                onClick={() => void handleKeepLocalList()}
                type="button"
              >
                Keep this version
              </button>
              <button
                className="button ghost"
                disabled={listConflictBusy}
                onClick={() => void handleUseLatestSavedList()}
                type="button"
              >
                {listConflictBusy ? 'Loading...' : 'Use latest saved version'}
              </button>
            </div>
            {listConflictError ? (
              <p className="auth-feedback danger">{listConflictError}</p>
            ) : null}
          </div>
        ) : null}

        <label className="field-stack">
          <span>Add to this list</span>
          <div className="inline-form">
            <input
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleQuickAdd();
                }
              }}
              placeholder={`Add to ${list.title}`}
              type="text"
              value={draft}
            />
            <button
              className="button accent"
              onClick={() => void handleQuickAdd()}
              type="button"
            >
              Add
            </button>
          </div>
        </label>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>{isActiveList ? 'Working now' : 'Current'}</h2>
          <p>
            {isActiveList
              ? 'Open items stay first. Crossed-off items stay visible lower while you work the list.'
              : list.kind === 'reference'
                ? 'What is still worth keeping close here.'
                : 'What still belongs on this list right now.'}
          </p>
        </div>
        {(isActiveList ? activeItems : openItems).length ? (
          <div className="item-list">
            {(isActiveList ? activeItems : openItems).map((entry) =>
              renderListItemCard(entry, { activeRun: isActiveList }),
            )}
          </div>
        ) : (
          <EmptyState>Nothing current in this list right now.</EmptyState>
        )}
      </Panel>

      {!isActiveList && doneItems.length ? (
        <Panel>
          <div className="panel-header split">
            <div>
              <h2>Done</h2>
              <p>What this list already carried through.</p>
            </div>
            <div className="dialog-actions">
              {list.kind === 'checklist' ? (
                <button
                  className="button ghost small"
                  onClick={() => void reopenAllDoneListItems(list.id)}
                  type="button"
                >
                  Reopen all done
                </button>
              ) : null}
              <button
                className="button ghost small"
                onClick={() => setDoneOpen((current) => !current)}
                type="button"
              >
                {doneOpen ? 'Hide done' : `Show done (${doneItems.length})`}
              </button>
            </div>
          </div>
          {doneOpen ? (
            <div className="item-list">{doneItems.map((entry) => renderListItemCard(entry))}</div>
          ) : (
            <div className="empty-inline">
              Done items stay out of the way until you need them.
            </div>
          )}
        </Panel>
      ) : null}

      {archivedItems.length ? (
        <Panel>
          <div className="panel-header">
            <h2>Archived</h2>
            <p>Older list items kept for retrieval, not current work.</p>
          </div>
          <div className="item-list">
            {archivedItems.map((entry) => renderListItemCard(entry))}
          </div>
        </Panel>
      ) : null}

      <FinishListDialog
        busy={finishBusy}
        error={finishError}
        isOpen={finishOpen}
        list={list}
        onClose={() => {
          if (finishBusy) {
            return;
          }
          setFinishOpen(false);
          setFinishError(null);
        }}
        onConfirm={(action) => void handleFinish(action)}
      />
    </div>
  );
}
