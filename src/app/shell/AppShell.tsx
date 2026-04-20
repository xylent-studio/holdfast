import type { ReactNode } from 'react';

import type { DateKey } from '@/domain/dates';
import { BottomNav } from '@/app/shell/BottomNav';
import { TopBar } from '@/app/shell/TopBar';

interface AppShellProps {
  children: ReactNode;
  currentDate: DateKey;
  onAdd: () => void;
  onChangeDate: (value: DateKey) => void;
  onOpenSettings: () => void;
  openCount: number;
  showDateControls: boolean;
  viewPath: string;
}

export function AppShell({
  children,
  currentDate,
  onAdd,
  onChangeDate,
  onOpenSettings,
  openCount,
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
          onOpenSettings={onOpenSettings}
          openCount={openCount}
          showDateControls={showDateControls}
        />
        <main className="app-content">{children}</main>
        <BottomNav viewPath={viewPath} />
      </div>
    </div>
  );
}
