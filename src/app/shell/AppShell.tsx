import type { ReactNode } from 'react';

import type { DateKey } from '@/domain/dates';
import { BottomNav } from '@/app/shell/BottomNav';
import { TopBar } from '@/app/shell/TopBar';
import { LoadingPanel } from '@/shared/ui/LoadingPanel';

interface AppShellProps {
  children: ReactNode;
  currentDate: DateKey;
  isLoading: boolean;
  onAdd: () => void;
  onChangeDate: (value: DateKey) => void;
  onOpenSettings: () => void;
  openCount: number;
  viewPath: string;
}

export function AppShell({
  children,
  currentDate,
  isLoading,
  onAdd,
  onChangeDate,
  onOpenSettings,
  openCount,
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
        />
        <main className="app-content">
          {isLoading ? <LoadingPanel /> : children}
        </main>
        <BottomNav viewPath={viewPath} />
      </div>
    </div>
  );
}
