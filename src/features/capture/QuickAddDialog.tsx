import { useState } from 'react';

import {
  planQuickAddItem,
  type QuickAddTimingMode,
} from '@/domain/logic/capture';
import type { DateKey } from '@/domain/dates';
import { createItem } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface QuickAddDialogProps {
  currentDate: DateKey;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickAddDialog({
  currentDate,
  isOpen,
  onClose,
}: QuickAddDialogProps) {
  const [rawText, setRawText] = useState('');
  const [shapeNow, setShapeNow] = useState(false);
  const [kind, setKind] = useState<'task' | 'note'>('task');
  const [placement, setPlacement] = useState<'today' | 'upcoming'>('today');
  const [timingMode, setTimingMode] = useState<QuickAddTimingMode>('tomorrow');
  const [chosenDate, setChosenDate] = useState<DateKey>(currentDate);
  const [chosenTime, setChosenTime] = useState('');

  const reset = (): void => {
    setRawText('');
    setShapeNow(false);
    setKind('task');
    setPlacement('today');
    setTimingMode('tomorrow');
    setChosenDate(currentDate);
    setChosenTime('');
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

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
    });

    if (!planned) {
      return;
    }

    await createItem(planned);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add">
      <div className="dialog-stack">
        <div>
          <div className="eyebrow">Capture</div>
          <h2>Add</h2>
          <p>
            Catch it first. Place it now only when the destination is already
            clear.
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
              Place it now
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
                  onChange={(event) =>
                    setChosenDate(event.target.value as DateKey)
                  }
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
          <button className="button ghost" onClick={handleClose} type="button">
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
    </Modal>
  );
}
