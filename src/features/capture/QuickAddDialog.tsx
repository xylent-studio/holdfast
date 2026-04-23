import { useMemo, useState } from 'react';

import {
  buildQuickAddDraft,
  planQuickAddItem,
  splitCapturedText,
  type QuickAddPlacement,
  type QuickAddTimingMode,
} from '@/domain/logic/capture';
import type { DateKey } from '@/domain/dates';
import {
  createItem,
  createListItem,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface QuickAddDialogProps {
  currentDate: DateKey;
  isOpen: boolean;
  lists: HoldfastSnapshot['lists'];
  onClose: () => void;
  preferredListId?: string | null;
  preferredPlacement?: QuickAddPlacement | null;
}

type DirectTarget =
  | {
      type: 'list';
      listId: string;
    }
  | {
      type: QuickAddPlacement;
    };

interface QuickAddDialogBodyProps {
  currentDate: DateKey;
  lists: HoldfastSnapshot['lists'];
  onClose: () => void;
  preferredListId: string | null;
  preferredPlacement: QuickAddPlacement | null;
}

function QuickAddDialogBody({
  currentDate,
  lists,
  onClose,
  preferredListId,
  preferredPlacement,
}: QuickAddDialogBodyProps) {
  const defaults = useMemo(
    () => buildQuickAddDraft(currentDate, preferredPlacement),
    [currentDate, preferredPlacement],
  );
  const preferredList =
    lists.find((entry) => entry.id === preferredListId && !entry.deletedAt) ?? null;
  const availableLists = lists.filter(
    (entry) =>
      !entry.deletedAt &&
      (entry.pinned || entry.id === preferredListId),
  );
  const [rawText, setRawText] = useState('');
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [target, setTarget] = useState<DirectTarget>(
    preferredList
      ? { type: 'list', listId: preferredList.id }
      : {
          type: preferredPlacement ?? defaults.placement,
        },
  );
  const [timingMode, setTimingMode] = useState<QuickAddTimingMode>(
    defaults.timingMode,
  );
  const [chosenDate, setChosenDate] = useState<DateKey>(defaults.chosenDate);
  const [chosenTime, setChosenTime] = useState(defaults.chosenTime);

  const handleSaveToInbox = async (): Promise<void> => {
    const planned = planQuickAddItem({
      rawText,
      currentDate,
      shapeNow: false,
      kind: 'task',
      placement: 'today',
      timingMode,
      chosenDate,
      chosenTime,
    });

    if (!planned) {
      return;
    }

    await createItem(planned);
    onClose();
  };

  const handlePlaceInTarget = async (directTarget: DirectTarget): Promise<void> => {
    const parsed = splitCapturedText(rawText);
    if (!parsed) {
      return;
    }

    if (directTarget.type === 'list') {
      await createListItem({
        listId: directTarget.listId,
        title: parsed.title,
        body: parsed.body,
      });
      onClose();
      return;
    }

    const planned = planQuickAddItem({
      rawText,
      currentDate,
      shapeNow: true,
      kind: 'task',
      placement: directTarget.type,
      timingMode,
      chosenDate,
      chosenTime,
      captureMode:
        preferredPlacement && preferredPlacement === directTarget.type
          ? 'context'
          : 'direct',
    });

    if (!planned) {
      return;
    }

    await createItem(planned);
    onClose();
  };

  const directTargetLabel =
    target.type === 'list'
      ? preferredList?.title ??
        availableLists.find((entry) => entry.id === target.listId)?.title ??
        'This list'
      : target.type === 'today'
        ? 'Now'
        : 'Upcoming';
  const contextualTarget = preferredList
    ? ({ type: 'list', listId: preferredList.id } as const)
    : preferredPlacement
      ? ({ type: preferredPlacement } as const)
      : null;
  const contextualActionLabel =
    contextualTarget?.type === 'list'
      ? `Add to ${preferredList?.title ?? 'This list'}`
      : contextualTarget?.type === 'today'
        ? 'Add to Now'
        : contextualTarget?.type === 'upcoming'
          ? 'Add to Upcoming'
          : null;
  const canSubmit = Boolean(splitCapturedText(rawText));

  return (
    <div className="dialog-stack">
      <div>
        <div className="eyebrow">Capture</div>
        <h2>Add</h2>
        <p>
          {preferredList
            ? `You're already in ${preferredList.title}. Catch it here or fall back to Inbox.`
            : preferredPlacement === 'today'
              ? 'You are already in Now. Catch it here or fall back to Inbox.'
              : preferredPlacement === 'upcoming'
                ? 'You are already in Upcoming. Catch it here or fall back to Inbox.'
                : 'Catch it first. Place it now only when the destination is already clear.'}
        </p>
      </div>

      <label className="field-stack">
        <span>What do you need to keep?</span>
        <textarea
          autoFocus
          onChange={(event) => setRawText(event.target.value)}
          placeholder="What do you need to keep?"
          rows={4}
          value={rawText}
        />
      </label>

      {showDestinationPicker ? (
        <>
          <div className="field-stack">
            <span>Place in</span>
            <div className="chip-row">
              <button
                className={`chip ${target.type === 'today' ? 'active' : ''}`}
                onClick={() => setTarget({ type: 'today' })}
                type="button"
              >
                Now
              </button>
              <button
                className={`chip ${target.type === 'upcoming' ? 'active' : ''}`}
                onClick={() => setTarget({ type: 'upcoming' })}
                type="button"
              >
                Upcoming
              </button>
              {availableLists.map((list) => (
                <button
                  className={`chip ${
                    target.type === 'list' && target.listId === list.id
                      ? 'active'
                      : ''
                  }`}
                  key={list.id}
                  onClick={() => setTarget({ type: 'list', listId: list.id })}
                  type="button"
                >
                  {list.title}
                </button>
              ))}
            </div>
          </div>

          {target.type === 'upcoming' ? (
            <>
              <div className="field-stack">
                <span>When</span>
                <div className="chip-row">
                  {(
                    [
                      ['tomorrow', 'Tomorrow'],
                      ['thisweek', 'This week'],
                      ['nextweek', 'Next week'],
                      ['date', 'Pick date'],
                      ['someday', 'No date'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      className={`chip ${timingMode === value ? 'active' : ''}`}
                      key={value}
                      onClick={() => setTimingMode(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {timingMode === 'date' ? (
                <label className="field-stack">
                  <span>Date</span>
                  <input
                    onChange={(event) =>
                      setChosenDate(event.target.value as DateKey)
                    }
                    type="date"
                    value={chosenDate}
                  />
                </label>
              ) : null}
              {timingMode !== 'someday' ? (
                <label className="field-stack">
                  <span>Time</span>
                  <input
                    onChange={(event) => setChosenTime(event.target.value)}
                    type="time"
                    value={chosenTime}
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <div className="dialog-actions spread">
        <button className="button ghost" onClick={onClose} type="button">
          Cancel
        </button>
        <div className="dialog-actions">
          {showDestinationPicker ? (
            <>
              <button
                className="button ghost"
                onClick={() => setShowDestinationPicker(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="button accent"
                disabled={!canSubmit}
                onClick={() => void handlePlaceInTarget(target)}
                type="button"
              >
                {target.type === 'list'
                  ? `Add to ${directTargetLabel}`
                  : target.type === 'today'
                    ? 'Add to Now'
                    : 'Add to Upcoming'}
              </button>
            </>
          ) : (
            <>
              <button
                className="button accent"
                disabled={!canSubmit}
                onClick={() => void handleSaveToInbox()}
                type="button"
              >
                Save to Inbox
              </button>
              {contextualTarget && contextualActionLabel ? (
                <button
                  className="button ghost"
                  disabled={!canSubmit}
                  onClick={() => void handlePlaceInTarget(contextualTarget)}
                  type="button"
                >
                  {contextualActionLabel}
                </button>
              ) : null}
              <button
                className="button ghost"
                disabled={!canSubmit}
                onClick={() => setShowDestinationPicker(true)}
                type="button"
              >
                Choose another place
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuickAddDialog({
  currentDate,
  isOpen,
  lists,
  onClose,
  preferredListId = null,
  preferredPlacement = null,
}: QuickAddDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen onClose={onClose} title="Add">
      <QuickAddDialogBody
        currentDate={currentDate}
        key={`${currentDate}-${preferredPlacement ?? preferredListId ?? 'inbox'}`}
        lists={lists}
        onClose={onClose}
        preferredListId={preferredListId}
        preferredPlacement={preferredPlacement}
      />
    </Modal>
  );
}
