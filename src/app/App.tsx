import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { AppShell } from '@/app/shell/AppShell';
import { QuickAddDialog } from '@/features/capture/QuickAddDialog';
import { InboxView } from '@/features/inbox/InboxView';
import { ItemDetailsDialog } from '@/features/item-details/ItemDetailsDialog';
import { NowView } from '@/features/now/NowView';
import { ReviewView } from '@/features/review/ReviewView';
import { SettingsView } from '@/features/settings/SettingsView';
import { UpcomingView } from '@/features/upcoming/UpcomingView';
import { todayDateKey } from '@/domain/dates';
import { openItems } from '@/domain/logic/selectors';
import { bootstrapHoldfast, useHoldfastSnapshot } from '@/storage/local/api';

function AppRoutes() {
  const [currentDate, setCurrentDate] = useState(todayDateKey());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const snapshot = useHoldfastSnapshot(currentDate);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrapHoldfast();
  }, []);

  const selectedItem = useMemo(
    () => snapshot?.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, snapshot?.items],
  );

  return (
    <>
      <AppShell
        currentDate={currentDate}
        isLoading={!snapshot}
        onAdd={() => setQuickAddOpen(true)}
        onChangeDate={setCurrentDate}
        onOpenSettings={() => navigate('/settings')}
        openCount={snapshot ? openItems(snapshot.items).length : 0}
        viewPath={location.pathname}
      >
        <Routes>
          <Route path="/" element={<Navigate replace to="/now" />} />
          <Route path="/today" element={<Navigate replace to="/now" />} />
          <Route
            path="/now"
            element={
              snapshot ? (
                <NowView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              ) : null
            }
          />
          <Route
            path="/inbox"
            element={snapshot ? <InboxView currentDate={currentDate} onOpenItem={setSelectedItemId} snapshot={snapshot} /> : null}
          />
          <Route
            path="/upcoming"
            element={
              snapshot ? (
                <UpcomingView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              ) : null
            }
          />
          <Route
            path="/review"
            element={
              snapshot ? (
                <ReviewView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              ) : null
            }
          />
          <Route
            path="/settings"
            element={snapshot ? <SettingsView currentDate={currentDate} snapshot={snapshot} /> : null}
          />
        </Routes>
      </AppShell>
      <QuickAddDialog currentDate={currentDate} isOpen={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      {selectedItem ? (
        <ItemDetailsDialog
          currentDate={currentDate}
          isFocused={Boolean(snapshot?.currentDay.focusItemIds.includes(selectedItem.id))}
          item={selectedItem}
          isOpen
          key={selectedItem.id}
          onClose={() => setSelectedItemId(null)}
        />
      ) : null}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
