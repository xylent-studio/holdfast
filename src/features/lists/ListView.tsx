import { useEffect, useMemo, useState } from 'react';

import { LIST_KIND_LABELS } from '@/domain/constants';
import { addDays, type DateKey } from '@/domain/dates';
import { activeListItemsForDisplay } from '@/domain/logic/selectors';
import {
  listItemMoveActionSpecs,
  wholeListMoveActionSpecs,
  type ItemSurfaceContext,
  type SurfaceActionId,
} from '@/domain/logic/surface-actions';
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
import { ScheduleConfirmDialog } from '@/shared/ui/ScheduleConfirmDialog';

interface ListViewProps {
  currentDate: DateKey;
  highlightListItemId?: string | null;
  listId: string;
  onOpenItem: (itemId: string, origin: ItemSurfaceContext) => void;
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
  const [managementOpen, setManagementOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

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
  const isArchivedList = Boolean(list?.archivedAt);
  const activeItems = useMemo(
    () => activeListItemsForDisplay(snapshot.listItems, listId),
    [listId, snapshot.listItems],
  );
  const isFocused = Boolean(
    list && (snapshot.currentDay.focusListIds ?? []).includes(list.id),
  );
  const isActiveList =
    !isArchivedList &&
    (Boolean(list?.scheduledDate && list.scheduledDate <= currentDate) ||
      isFocused);
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

    const highlighted = document.querySelector<HTMLElement>(
      `[data-list-item-id="${highlightListItemId}"]`,
    );

    highlighted?.scrollIntoView?.({ block: 'center' });
    highlighted?.focus({ preventScroll: true });
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

  const wholeListMoveActions = wholeListMoveActionSpecs({
    currentDate,
    isFocused,
    list,
  });
  const primaryWholeListAction =
    list.kind === 'reference'
      ? null
      : wholeListMoveActions.find((action) => action.priority === 'primary') ??
        wholeListMoveActions[0] ??
        null;
  const managementWholeListActions = wholeListMoveActions.filter(
    (action) => action.id !== primaryWholeListAction?.id,
  );

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

  const handleWholeListMoveAction = (actionId: SurfaceActionId): void => {
    switch (actionId) {
      case 'bring-to-now':
        void moveListToNow(list.id, currentDate);
        break;
      case 'focus':
        void setListFocus(currentDate, list.id, true);
        break;
      case 'remove-focus':
        void setListFocus(currentDate, list.id, false);
        break;
      case 'remove-from-now':
      case 'unschedule':
        void clearListSchedule(list.id);
        break;
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
    const moveActions = listItemMoveActionSpecs({
      list,
      listItem: entry,
      wholeListActive: isActiveList,
    });

    return (
      <div
        className={`item-card day-result ${
          highlightListItemId === entry.id ? 'focus' : ''
        }${activeRun && entry.status === 'done' ? ' crossed-off' : ''}`}
        data-list-item-id={entry.id}
        key={entry.id}
        tabIndex={highlightListItemId === entry.id ? -1 : undefined}
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
        {!isArchivedList ? (
          <div className="dialog-actions">
            {moveActions.map((action) => (
              <button
                className={`button ${action.tone === 'accent' ? 'accent' : 'ghost'} small`}
                key={`${entry.id}-${action.id}`}
                onClick={() => {
                  switch (action.id) {
                    case 'bring-to-now':
                      void promoteListItemToNow(entry.id, currentDate);
                      break;
                    case 'remove-from-now':
                      void updateListItem(entry.id, { nowDate: null });
                      break;
                  }
                }}
                type="button"
              >
                {action.label}
              </button>
            ))}
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
            {entry.status === 'open' &&
            ['project', 'checklist'].includes(list.kind) ? (
              <button
                className="button ghost small"
                onClick={() =>
                  void createTaskFromListItem(entry.id, currentDate).then((itemId) => {
                    if (itemId) {
                      onOpenItem(itemId, { route: 'list', listId: list.id });
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
                onClick={() => onOpenItem(sourceItem.id, { route: 'list', listId: list.id })}
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
        ) : null}
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
            {isArchivedList ? <span className="chip small">Archived</span> : null}
            {list.pinned ? <span className="chip active">Pinned</span> : null}
          </div>
        </div>

        {!isArchivedList ? (
          <div className="dialog-actions wrap">
            {primaryWholeListAction ? (
              <button
                className={`button ${primaryWholeListAction.tone === 'accent' ? 'accent' : 'ghost'} small`}
                onClick={() => handleWholeListMoveAction(primaryWholeListAction.id)}
                type="button"
              >
                {primaryWholeListAction.label}
              </button>
            ) : null}
            <button
              className="button ghost small"
              onClick={() => setManagementOpen((current) => !current)}
              type="button"
            >
              {managementOpen ? 'Hide list actions' : 'Manage list'}
            </button>
          </div>
        ) : (
          <div className="empty-inline">
            Archived lists stay searchable for reference. They are not active work surfaces.
          </div>
        )}

        {managementOpen && !isArchivedList ? (
          <div className="dialog-actions wrap">
            {managementWholeListActions.map((action) => (
              <button
                className="button ghost small"
                key={action.id}
                onClick={() => handleWholeListMoveAction(action.id)}
                type="button"
              >
                {action.label}
              </button>
            ))}
            <button
              className="button ghost small"
              onClick={() => setScheduleOpen(true)}
              type="button"
            >
              Schedule
            </button>
            <button
              className="button ghost small"
              onClick={() => void updateList(list.id, { pinned: !list.pinned })}
              type="button"
            >
              {list.pinned ? 'Unpin' : 'Pin'}
            </button>
            {list.kind !== 'reference' ? (
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
            ) : null}
          </div>
        ) : null}

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

        {!isArchivedList ? (
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
        ) : null}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>
            {isArchivedList ? 'Archived snapshot' : isActiveList ? 'Working now' : 'Current'}
          </h2>
          <p>
            {isArchivedList
              ? 'This is preserved exactly for retrieval.'
              : isActiveList
              ? 'Open items stay first. Crossed-off items stay visible lower while you work the list.'
              : list.kind === 'reference'
                ? 'What is still worth keeping close here.'
                : 'What still belongs on this list right now.'}
          </p>
        </div>
        {(isArchivedList ? items : isActiveList ? activeItems : openItems).length ? (
          <div className="item-list">
            {(isArchivedList ? items : isActiveList ? activeItems : openItems).map(
              (entry) => renderListItemCard(entry, { activeRun: isActiveList }),
            )}
          </div>
        ) : (
          <EmptyState>Nothing current in this list right now.</EmptyState>
        )}
      </Panel>

      {!isArchivedList && !isActiveList && doneItems.length ? (
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

      {!isArchivedList && archivedItems.length ? (
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
      {scheduleOpen ? (
        <ScheduleConfirmDialog
          confirmLabel="Schedule"
          defaultDate={(list.scheduledDate ?? addDays(currentDate, 1)) as DateKey}
          defaultTime={list.scheduledTime ?? ''}
          description="Pick when this list should show up in Upcoming."
          onClose={() => setScheduleOpen(false)}
          onConfirm={(date, time) => scheduleList(list.id, date, time)}
          title="Schedule this list"
        />
      ) : null}
    </div>
  );
}
