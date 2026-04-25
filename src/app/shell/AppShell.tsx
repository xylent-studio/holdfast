import type { ReactNode } from 'react';

import type { DateKey } from '@/domain/dates';
import { BottomNav } from '@/app/shell/BottomNav';
import { TopBar } from '@/app/shell/TopBar';
import { useCompactLayout } from '@/shared/ui/useCompactLayout';

interface AppShellProps {
  children: ReactNode;
  currentDate: DateKey;
  onAdd: () => void;
  onChangeDate: (value: DateKey) => void;
  onOpenListsHome: () => void;
  onOpenSettings: () => void;
  showDateControls: boolean;
  viewPath: string;
}

export function AppShell({
  children,
  currentDate,
  onAdd,
  onChangeDate,
  onOpenListsHome,
  onOpenSettings,
  showDateControls,
  viewPath,
}: AppShellProps) {
  const compactLayout = useCompactLayout();

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <div className="app-frame">
        <TopBar
          currentDate={currentDate}
          onAdd={onAdd}
          onChangeDate={onChangeDate}
          onOpenListsHome={onOpenListsHome}
          onOpenSettings={onOpenSettings}
          showDateControls={showDateControls}
          viewPath={viewPath}
        />
        <main className="app-content">{children}</main>
        {compactLayout ? (
          <button
            aria-label="Add capture"
            className="button accent mobile-add-button"
            onClick={onAdd}
            type="button"
          >
            Add
          </button>
        ) : null}
        <BottomNav viewPath={viewPath} />
      </div>
    </div>
  );
}
