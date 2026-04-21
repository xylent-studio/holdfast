import { useState } from 'react';

import type { DailyRecord } from '@/domain/schemas/records';
import type { DateKey } from '@/domain/dates';
import { closeDay } from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

interface FinishDayDialogProps {
  currentDate: DateKey;
  day: DailyRecord;
  isOpen: boolean;
  onClose: () => void;
}

export function FinishDayDialog({ currentDate, day, isOpen, onClose }: FinishDayDialogProps) {
  const [closeWin, setCloseWin] = useState(day.closeWin);
  const [closeCarry, setCloseCarry] = useState(day.closeCarry);
  const [closeSeed, setCloseSeed] = useState(day.closeSeed);
  const [closeNote, setCloseNote] = useState(day.closeNote);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(day.closeWin.trim() || day.closeNote.trim()),
  );

  const handleSave = async (): Promise<void> => {
    await closeDay(currentDate, {
      closeWin,
      closeCarry,
      closeSeed,
      closeNote,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finish day">
      <div className="dialog-stack">
        <div>
          <div className="eyebrow">Closeout</div>
          <h2>Finish day</h2>
          <p>Only keep what helps tomorrow start cleaner.</p>
        </div>
        <label className="field-stack">
          <span>What still matters</span>
          <textarea
            onChange={(event) => setCloseCarry(event.target.value)}
            rows={4}
            value={closeCarry}
          />
        </label>
        <label className="field-stack">
          <span>Note for tomorrow</span>
          <textarea
            onChange={(event) => setCloseSeed(event.target.value)}
            rows={3}
            value={closeSeed}
          />
        </label>
        <div className="dialog-actions">
          <button
            className="button ghost small"
            onClick={() => setDetailsOpen((value) => !value)}
            type="button"
          >
            {detailsOpen ? 'Hide extra notes' : 'Add a win or note'}
          </button>
        </div>
        {detailsOpen ? (
          <>
            <label className="field-stack">
              <span>What landed</span>
              <textarea
                onChange={(event) => setCloseWin(event.target.value)}
                rows={3}
                value={closeWin}
              />
            </label>
            <label className="field-stack">
              <span>Note</span>
              <textarea
                onChange={(event) => setCloseNote(event.target.value)}
                rows={3}
                value={closeNote}
              />
            </label>
          </>
        ) : null}
        <div className="dialog-actions">
          <button className="button ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="button accent"
            onClick={() => void handleSave()}
            type="button"
          >
            Save closeout
          </button>
        </div>
      </div>
    </Modal>
  );
}
