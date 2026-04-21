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
  const openLabel = `${openCount} ${openCount === 1 ? 'thing' : 'things'} in play`;

  const dateState =
    delta === 0 ? 'Today' : delta > 0 ? `${delta} day${delta === 1 ? '' : 's'} ahead` : `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} back`;

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <div className="eyebrow">In view</div>
        <div className="topbar-heading-row">
          <div className="topbar-date">{niceDate(currentDate)}</div>
          <span className="topbar-count">{openLabel}</span>
        </div>
        <div className="topbar-meta">
          <span>{dateState}</span>
        </div>
      </div>
      <div className="topbar-actions">
        {showDateControls ? (
          <div className="topbar-tools">
            <div className="date-controls">
              <button
                className="button ghost small"
                onClick={() => onChangeDate(addDays(currentDate, -1))}
                type="button"
              >
                Back
              </button>
              <button
                className={`button small ${currentDate === today ? 'accent' : 'ghost'}`}
                onClick={() => onChangeDate(today)}
                type="button"
              >
                Today
              </button>
              <button
                className="button ghost small"
                onClick={() => onChangeDate(addDays(currentDate, 1))}
                type="button"
              >
                Ahead
              </button>
            </div>
            <button
              className={`button ghost small ${showDateJump ? 'active-toggle' : ''}`}
              onClick={() => setShowDateJump((current) => !current)}
              type="button"
            >
              Choose date
            </button>
            {showDateJump ? (
              <input
                className="date-input"
                onChange={(event) => onChangeDate(event.target.value as DateKey)}
                type="date"
                value={currentDate}
              />
            ) : null}
          </div>
        ) : null}
        <div className="topbar-primary-actions">
          <button className="button accent" onClick={onAdd} type="button">
            Add
          </button>
          <button
            className="button ghost small"
            onClick={onOpenSettings}
            type="button"
          >
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}
