import type { ReactNode } from 'react';

import type { DateKey } from '@/domain/dates';
import { BottomNav } from '@/app/shell/BottomNav';
import { TopBar } from '@/app/shell/TopBar';

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
        <BottomNav viewPath={viewPath} />
      </div>
    </div>
  );
}
