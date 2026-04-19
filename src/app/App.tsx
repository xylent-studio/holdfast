import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AuthCallbackView } from '@/app/auth/AuthCallbackView';
import { AuthLandingView } from '@/app/auth/AuthLandingView';
import { AuthProvider, useAuth } from '@/app/auth/AuthProvider';
import { AuthRecoveryPanel } from '@/app/auth/AuthRecoveryPanel';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
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
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrapHoldfast();
  }, []);

  const selectedItem = useMemo(
    () => snapshot?.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, snapshot?.items],
  );
  const hasLocalData = snapshot ? hasMeaningfulLocalState(snapshot) : false;
  const shouldWaitForAuthGate =
    Boolean(snapshot) && auth.configured && !auth.isReady && !hasLocalData;
  const shouldShowLanding =
    Boolean(snapshot) &&
    auth.configured &&
    auth.isReady &&
    !auth.session &&
    !hasLocalData;
  const shouldShowSessionRecovery =
    Boolean(snapshot) &&
    auth.configured &&
    auth.isReady &&
    !auth.session &&
    snapshot.syncState.identityState === 'member';

  if (location.pathname === '/auth/callback') {
    return <AuthCallbackView />;
  }

  if (shouldWaitForAuthGate) {
    return (
      <div className="auth-shell">
        <section className="panel auth-card">
          <div className="auth-copy">
            <div className="eyebrow">Holdfast</div>
            <h1>Opening Holdfast</h1>
            <p>Getting things ready.</p>
          </div>
        </section>
      </div>
    );
  }

  if (shouldShowLanding) {
    return <AuthLandingView nextPath={location.pathname} />;
  }

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
        {shouldShowSessionRecovery && location.pathname !== '/settings' ? (
          <AuthRecoveryPanel nextPath={location.pathname} />
        ) : null}
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
            element={
              snapshot ? (
                <InboxView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              ) : null
            }
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
            element={
              snapshot ? (
                <SettingsView currentDate={currentDate} snapshot={snapshot} />
              ) : null
            }
          />
        </Routes>
      </AppShell>
      <QuickAddDialog
        currentDate={currentDate}
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
      {selectedItem ? (
        <ItemDetailsDialog
          currentDate={currentDate}
          isFocused={Boolean(
            snapshot?.currentDay.focusItemIds.includes(selectedItem.id),
          )}
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
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
