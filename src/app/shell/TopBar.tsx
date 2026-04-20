import { useState } from 'react';

import { addDays, niceDate, todayDateKey, type DateKey } from '@/domain/dates';

interface TopBarProps {
  currentDate: DateKey;
  onAdd: () => void;
  onChangeDate: (value: DateKey) => void;
  onOpenSettings: () => void;
  openCount: number;
  showDateControls: boolean;
}

export function TopBar({
  currentDate,
  onAdd,
  onChangeDate,
  onOpenSettings,
  openCount,
  showDateControls,
}: TopBarProps) {
  const [showDateJump, setShowDateJump] = useState(false);
  const today = todayDateKey();
  const delta =
    (new Date(`${currentDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000;

  const dateState =
    delta === 0 ? 'Today' : delta > 0 ? `${delta} day${delta === 1 ? '' : 's'} ahead` : `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} back`;

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <div className="eyebrow">Holdfast</div>
        <div className="topbar-date">{niceDate(currentDate)}</div>
        <div className="topbar-meta">
          <span>{dateState}</span>
          <span>{openCount} open</span>
        </div>
      </div>
      <div className="topbar-actions">
        {showDateControls ? (
          <>
            <div className="date-controls">
              <button
                className="button ghost"
                onClick={() => onChangeDate(addDays(currentDate, -1))}
                type="button"
              >
                Prev
              </button>
              <button
                className={`button ${currentDate === today ? 'accent' : 'ghost'}`}
                onClick={() => onChangeDate(today)}
                type="button"
              >
                Today
              </button>
              <button
                className="button ghost"
                onClick={() => onChangeDate(addDays(currentDate, 1))}
                type="button"
              >
                Next
              </button>
            </div>
            <button
              className={`button ghost ${showDateJump ? 'active-toggle' : ''}`}
              onClick={() => setShowDateJump((current) => !current)}
              type="button"
            >
              Jump to date
            </button>
            {showDateJump ? (
              <input
                className="date-input"
                onChange={(event) => onChangeDate(event.target.value as DateKey)}
                type="date"
                value={currentDate}
              />
            ) : null}
          </>
        ) : null}
        <button className="button accent" onClick={onAdd} type="button">
          Add
        </button>
        <button className="button ghost" onClick={onOpenSettings} type="button">
          Settings
        </button>
      </div>
    </header>
  );
}
