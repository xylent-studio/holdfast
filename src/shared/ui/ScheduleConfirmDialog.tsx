import { useState } from 'react';

import type { DateKey } from '@/domain/dates';
import { Modal } from '@/shared/ui/Modal';

interface ScheduleConfirmDialogProps {
  confirmLabel?: string;
  defaultDate: DateKey;
  defaultTime?: string | null;
  description: string;
  onClose: () => void;
  onConfirm: (date: DateKey, time: string | null) => Promise<void> | void;
  title: string;
}

export function ScheduleConfirmDialog({
  confirmLabel = 'Schedule',
  defaultDate,
  defaultTime = '',
  description,
  onClose,
  onConfirm,
  title,
}: ScheduleConfirmDialogProps) {
  const [chosenDate, setChosenDate] = useState<DateKey>(defaultDate);
  const [chosenTime, setChosenTime] = useState(defaultTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      await onConfirm(chosenDate, chosenTime.trim() || null);
      onClose();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Couldn't schedule that yet.",
      );
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={busy ? () => undefined : onClose} title={title}>
      <div className="dialog-stack">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="grid two">
          <label className="field-stack">
            <span>Date</span>
            <input
              onChange={(event) => setChosenDate(event.target.value as DateKey)}
              type="date"
              value={chosenDate}
            />
          </label>
          <label className="field-stack">
            <span>Time</span>
            <input
              onChange={(event) => setChosenTime(event.target.value)}
              type="time"
              value={chosenTime}
            />
          </label>
        </div>

        {error ? <p className="auth-feedback danger">{error}</p> : null}

        <div className="dialog-actions spread">
          <button className="button ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="button accent"
            disabled={!chosenDate || busy}
            onClick={() => void handleConfirm()}
            type="button"
          >
            {busy ? 'Saving...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
