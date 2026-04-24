import { useState } from 'react';

import { addDays, niceDate, todayDateKey, type DateKey } from '@/domain/dates';

interface TopBarProps {
  currentDate: DateKey;
  onAdd: () => void;
  onChangeDate: (value: DateKey) => void;
  onOpenListsHome: () => void;
  onOpenSettings: () => void;
  showDateControls: boolean;
  viewPath: string;
}

function topBarTitle(viewPath: string): string {
  if (viewPath === '/inbox') {
    return 'Inbox';
  }
  if (viewPath === '/upcoming') {
    return 'Upcoming';
  }
  if (viewPath === '/review') {
    return 'Review';
  }
  if (viewPath === '/lists' || viewPath.startsWith('/lists/')) {
    return 'Lists';
  }
  if (viewPath === '/settings') {
    return 'Settings';
  }
  return 'Now';
}

export function TopBar({
  currentDate,
  onAdd,
  onChangeDate,
  onOpenListsHome,
  onOpenSettings,
  showDateControls,
  viewPath,
}: TopBarProps) {
  const [showDateJump, setShowDateJump] = useState(false);
  const today = todayDateKey();
  const delta =
    (new Date(`${currentDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000;
  const title = topBarTitle(viewPath);
  const showsListsHomeButton = viewPath.startsWith('/lists/');

  const dateState =
    delta === 0 ? 'Today' : delta > 0 ? `${delta} day${delta === 1 ? '' : 's'} ahead` : `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} back`;

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <div className="eyebrow">Holdfast</div>
        <div className="topbar-heading-row">
          <div className="topbar-date">{title}</div>
        </div>
        {showDateControls ? (
          <div className="topbar-meta">
            <span>{niceDate(currentDate)}</span>
            <span>{dateState}</span>
          </div>
        ) : null}
      </div>
      <div className="topbar-actions">
        {showDateControls || showsListsHomeButton ? (
          <div className="topbar-tools">
            {showsListsHomeButton ? (
              <button
                className="button ghost small"
                onClick={onOpenListsHome}
                type="button"
              >
                All lists
              </button>
            ) : null}
            {showDateControls ? (
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
            ) : null}
            {showDateControls ? (
              <>
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
              </>
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
