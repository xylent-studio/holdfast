import { useMemo, useState } from 'react';

import { LANES } from '@/domain/constants';
import { resolveQuickDate } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import type { ItemKind, ItemStatus } from '@/domain/schemas/records';
import { createItem } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface QuickAddDialogProps {
  currentDate: DateKey;
  isOpen: boolean;
  onClose: () => void;
}

type TimingMode = 'tomorrow' | 'thisweek' | 'nextweek' | 'date' | 'someday';

export function QuickAddDialog({ currentDate, isOpen, onClose }: QuickAddDialogProps) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('task');
  const [lane, setLane] = useState<(typeof LANES)[number]['key']>('admin');
  const [status, setStatus] = useState<ItemStatus>('inbox');
  const [timingMode, setTimingMode] = useState<TimingMode>('tomorrow');
  const [chosenDate, setChosenDate] = useState<DateKey>(currentDate);
  const [chosenTime, setChosenTime] = useState('');

  const resolvedDate = useMemo(() => resolveQuickDate(timingMode, currentDate, chosenDate), [chosenDate, currentDate, timingMode]);

  const reset = (): void => {
    setTitle('');
    setKind('task');
    setLane('admin');
    setStatus('inbox');
    setTimingMode('tomorrow');
    setChosenDate(currentDate);
    setChosenTime('');
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    const scheduledDate =
      status === 'today' ? currentDate : status === 'upcoming' ? resolvedDate : null;
    const scheduledTime = status === 'inbox' ? null : chosenTime || null;

    await createItem({
      title: trimmed,
      kind,
      lane,
      status,
      sourceDate: currentDate,
      scheduledDate,
      scheduledTime,
    });

    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add">
      <div className="dialog-stack">
        <div>
          <div className="eyebrow">Capture</div>
          <h2>Add</h2>
          <p>Catch it fast, then give it the right place.</p>
        </div>
        <label className="field-stack">
          <span>Title</span>
          <input autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="What needs a place?" type="text" value={title} />
        </label>
        <div className="grid two">
          <label className="field-stack">
            <span>Type</span>
            <select onChange={(event) => setKind(event.target.value as ItemKind)} value={kind}>
              <option value="task">Task</option>
              <option value="note">Note</option>
            </select>
          </label>
          <label className="field-stack">
            <span>Area</span>
            <select onChange={(event) => setLane(event.target.value as (typeof LANES)[number]['key'])} value={lane}>
              {LANES.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-stack">
          <span>Place</span>
          <div className="chip-row">
            {(['inbox', 'today', 'upcoming'] as const).map((entry) => (
              <button
                className={`chip ${status === entry ? 'active' : ''}`}
                key={entry}
                onClick={() => setStatus(entry)}
                type="button"
              >
                {entry === 'inbox' ? 'Inbox' : entry === 'today' ? 'Now' : 'Upcoming'}
              </button>
            ))}
          </div>
        </div>
        {status === 'upcoming' ? (
          <div className="field-stack">
            <span>When</span>
            <div className="chip-row">
              {([
                ['tomorrow', 'Tomorrow'],
                ['thisweek', 'This week'],
                ['nextweek', 'Next week'],
                ['date', 'Pick date'],
                ['someday', 'No date'],
              ] as const).map(([value, label]) => (
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
        {status === 'upcoming' && timingMode === 'date' ? (
          <label className="field-stack">
            <span>Date</span>
            <input onChange={(event) => setChosenDate(event.target.value as DateKey)} type="date" value={chosenDate} />
          </label>
        ) : null}
        {status !== 'inbox' && timingMode !== 'someday' ? (
          <label className="field-stack">
            <span>Time</span>
            <input onChange={(event) => setChosenTime(event.target.value)} type="time" value={chosenTime} />
          </label>
        ) : null}
        <div className="dialog-actions">
          <button className="button ghost" onClick={handleClose} type="button">
            Cancel
          </button>
          <button className="button accent" onClick={() => void handleSubmit()} type="button">
            {status === 'today' ? 'Add to Now' : status === 'upcoming' ? 'Add to Upcoming' : 'Add to Inbox'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
