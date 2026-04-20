import { useMemo, useState } from 'react';

import {
  buildQuickAddDraft,
  planQuickAddItem,
  type QuickAddPlacement,
  type QuickAddTimingMode,
} from '@/domain/logic/capture';
import type { DateKey } from '@/domain/dates';
import { createItem } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface QuickAddDialogProps {
  currentDate: DateKey;
  isOpen: boolean;
  onClose: () => void;
  preferredPlacement?: QuickAddPlacement | null;
}

interface QuickAddDialogBodyProps {
  currentDate: DateKey;
  onClose: () => void;
  preferredPlacement: QuickAddPlacement | null;
}

function QuickAddDialogBody({
  currentDate,
  onClose,
  preferredPlacement,
}: QuickAddDialogBodyProps) {
  const defaults = useMemo(
    () => buildQuickAddDraft(currentDate, preferredPlacement),
    [currentDate, preferredPlacement],
  );
  const [rawText, setRawText] = useState('');
  const [shapeNow, setShapeNow] = useState(defaults.shapeNow);
  const [kind, setKind] = useState<'task' | 'note'>(defaults.kind);
  const [placement, setPlacement] = useState<QuickAddPlacement>(
    defaults.placement,
  );
  const [timingMode, setTimingMode] = useState<QuickAddTimingMode>(
    defaults.timingMode,
  );
  const [chosenDate, setChosenDate] = useState<DateKey>(defaults.chosenDate);
  const [chosenTime, setChosenTime] = useState(defaults.chosenTime);

  const handleSubmit = async (): Promise<void> => {
    const planned = planQuickAddItem({
      rawText,
      currentDate,
      shapeNow,
      kind,
      placement,
      timingMode,
      chosenDate,
      chosenTime,
      captureMode:
        shapeNow && preferredPlacement && preferredPlacement === placement
          ? defaults.captureMode
          : 'direct',
    });

    if (!planned) {
      return;
    }

    await createItem(planned);
    onClose();
  };

  return (
    <div className="dialog-stack">
      <div>
        <div className="eyebrow">Capture</div>
        <h2>Add</h2>
        <p>
          {preferredPlacement
            ? `You're already in ${
                preferredPlacement === 'today' ? 'Now' : 'Upcoming'
              }. Add it there or catch it in Inbox first.`
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
      <div className="field-stack">
        <span>Destination</span>
        <div className="chip-row">
          <button
            className={`chip ${!shapeNow ? 'active' : ''}`}
            onClick={() => setShapeNow(false)}
            type="button"
          >
            Inbox first
          </button>
          <button
            className={`chip ${shapeNow ? 'active' : ''}`}
            onClick={() => setShapeNow(true)}
            type="button"
          >
            {preferredPlacement === 'today'
              ? 'Place in Now'
              : preferredPlacement === 'upcoming'
                ? 'Place in Upcoming'
                : 'Place it now'}
          </button>
        </div>
      </div>
      {shapeNow ? (
        <>
          <div className="field-stack">
            <span>Shape</span>
            <div className="chip-row">
              {(
                [
                  ['task', 'Task'],
                  ['note', 'Note'],
                ] as const
              ).map(([value, label]) => (
                <button
                  className={`chip ${kind === value ? 'active' : ''}`}
                  key={value}
                  onClick={() => setKind(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-stack">
            <span>Place</span>
            <div className="chip-row">
              {(
                [
                  ['today', 'Now'],
                  ['upcoming', 'Upcoming'],
                ] as const
              ).map(([value, label]) => (
                <button
                  className={`chip ${placement === value ? 'active' : ''}`}
                  key={value}
                  onClick={() => setPlacement(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {placement === 'upcoming' ? (
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
          ) : null}
          {placement === 'upcoming' && timingMode === 'date' ? (
            <label className="field-stack">
              <span>Date</span>
              <input
                onChange={(event) => setChosenDate(event.target.value as DateKey)}
                type="date"
                value={chosenDate}
              />
            </label>
          ) : null}
          {placement === 'today' || timingMode !== 'someday' ? (
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
      <div className="dialog-actions">
        <button className="button ghost" onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className="button accent"
          onClick={() => void handleSubmit()}
          type="button"
        >
          {!shapeNow
            ? 'Save to Inbox'
            : placement === 'today'
              ? 'Add to Now'
              : 'Add to Upcoming'}
        </button>
      </div>
    </div>
  );
}

export function QuickAddDialog({
  currentDate,
  isOpen,
  onClose,
  preferredPlacement = null,
}: QuickAddDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen onClose={onClose} title="Add">
      <QuickAddDialogBody
        currentDate={currentDate}
        key={`${currentDate}-${preferredPlacement ?? 'inbox'}`}
        onClose={onClose}
        preferredPlacement={preferredPlacement}
      />
    </Modal>
  );
}
