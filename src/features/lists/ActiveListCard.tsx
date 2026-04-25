import { useMemo, useState } from 'react';

import { LIST_KIND_LABELS } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import { niceDate, niceTime } from '@/domain/dates';
import { activeListItemsForDisplay } from '@/domain/logic/selectors';
import { wholeListMoveActionSpecs } from '@/domain/logic/surface-actions';
import type { ListItemRecord, ListRecord } from '@/domain/schemas/records';
import {
  clearListSchedule,
  finishList,
  moveListToNow,
  setListFocus,
  updateListItem,
  type FinishListAction,
} from '@/storage/local/api';

import { FinishListDialog } from '@/features/lists/FinishListDialog';

interface ActiveListCardProps {
  currentDate: DateKey;
  isFocused?: boolean;
  list: ListRecord;
  listItems: ListItemRecord[];
  onOpenList: (listId: string) => void;
}

export function ActiveListCard({
  currentDate,
  isFocused = false,
  list,
  listItems,
  onOpenList,
}: ActiveListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const displayItems = useMemo(
    () => activeListItemsForDisplay(listItems, list.id),
    [list.id, listItems],
  );
  const openCount = displayItems.filter((item) => item.status === 'open').length;
  const doneCount = displayItems.filter((item) => item.status === 'done').length;
  const scheduleLabel = (() => {
    if (!list.scheduledDate) {
      return null;
    }
    if (list.scheduledDate < currentDate) {
      return `Overdue since ${niceDate(list.scheduledDate)}`;
    }
    if (list.scheduledDate === currentDate) {
      return 'In Now';
    }
    return `Scheduled for ${niceDate(list.scheduledDate)}`;
  })();
  const moveActions = wholeListMoveActionSpecs({
    currentDate,
    isFocused,
    list,
  });
  const primaryMoveAction =
    list.kind === 'reference'
      ? null
      : moveActions.find((action) => action.priority === 'primary') ??
        moveActions[0] ??
        null;
  const managementActions = moveActions.filter(
    (action) => action.id !== primaryMoveAction?.id,
  );
  const canFinishList = list.kind !== 'reference';

  const handleWholeListAction = (actionId: (typeof moveActions)[number]['id']): void => {
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

  const handleFinish = async (action: FinishListAction): Promise<void> => {
    setFinishError(null);
    setFinishBusy(true);

    try {
      await finishList(list.id, action, currentDate);
      setFinishOpen(false);
      setExpanded(false);
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

  return (
    <>
      <div className={`item-card day-result active-list-card${expanded ? ' expanded' : ''}`}>
        <div className="eyebrow">{LIST_KIND_LABELS[list.kind]} list</div>
        <div className="item-title-row">
          <h3>{list.title}</h3>
          <div className="chip-row">
            {scheduleLabel ? <span className="chip small">{scheduleLabel}</span> : null}
            {list.scheduledTime ? (
              <span className="chip small">{niceTime(list.scheduledTime)}</span>
            ) : null}
            {isFocused ? <span className="chip active">Focus</span> : null}
            <span className="chip small">{openCount} current</span>
            {doneCount ? <span className="chip small">{doneCount} crossed off</span> : null}
          </div>
        </div>

        <div className="dialog-actions">
          {primaryMoveAction ? (
            <button
              className={`button ${primaryMoveAction.tone === 'accent' ? 'accent' : 'ghost'} small`}
              onClick={() => handleWholeListAction(primaryMoveAction.id)}
              type="button"
            >
              {primaryMoveAction.label}
            </button>
          ) : null}
          <button
            className="button ghost small"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            className="button ghost small"
            onClick={() => onOpenList(list.id)}
            type="button"
          >
            Open list
          </button>
        </div>

        {expanded && (managementActions.length || canFinishList) ? (
          <div className="dialog-actions">
            {managementActions.map((action) => (
              <button
                className="button ghost small"
                key={action.id}
                onClick={() => handleWholeListAction(action.id)}
                type="button"
              >
                {action.label}
              </button>
            ))}
            {canFinishList ? (
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

        {expanded ? (
          displayItems.length ? (
            <div className="stack compact">
              {displayItems.map((item) => (
                <div
                  className={`list-run-item${item.status === 'done' ? ' done' : ''}`}
                  key={item.id}
                >
                  <div className="list-run-item-main">
                    <strong>{item.title}</strong>
                    {item.body.trim() ? <p>{item.body}</p> : null}
                  </div>
                  <div className="dialog-actions">
                    <button
                      className="button ghost small"
                      onClick={() =>
                        void updateListItem(item.id, {
                          status: item.status === 'done' ? 'open' : 'done',
                        })
                      }
                      type="button"
                    >
                      {item.status === 'done' ? 'Reopen' : 'Cross off'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-text">No items in this run.</p>
          )
        ) : null}
      </div>

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
    </>
  );
}
