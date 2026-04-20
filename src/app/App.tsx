import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AuthCallbackView } from '@/app/auth/AuthCallbackView';
import { shouldShowAuthLanding } from '@/app/auth/gating';
import { AuthLandingView } from '@/app/auth/AuthLandingView';
import { AuthProvider } from '@/app/auth/AuthProvider';
import { AuthRecoveryPanel } from '@/app/auth/AuthRecoveryPanel';
import { shouldShowSessionRecovery as shouldShowRecoveryPanel } from '@/app/auth/recovery';
import { useAuth } from '@/app/auth/useAuth';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { SyncProvider } from '@/app/sync/SyncProvider';
import { AppShell } from '@/app/shell/AppShell';
import { QuickAddDialog } from '@/features/capture/QuickAddDialog';
import { NowView } from '@/features/now/NowView';
import { UpcomingView } from '@/features/upcoming/UpcomingView';
import { todayDateKey } from '@/domain/dates';
import { openItems } from '@/domain/logic/selectors';
import { bootstrapHoldfast, useHoldfastSnapshot } from '@/storage/local/api';
import { LoadingPanel } from '@/shared/ui/LoadingPanel';
const InboxView = lazy(async () =>
  import('@/features/inbox/InboxView').then((module) => ({
    default: module.InboxView,
  })),
);
const ItemDetailsDialog = lazy(async () =>
  import('@/features/item-details/ItemDetailsDialog').then((module) => ({
    default: module.ItemDetailsDialog,
  })),
);
const ReviewView = lazy(async () =>
  import('@/features/review/ReviewView').then((module) => ({
    default: module.ReviewView,
  })),
);
const SettingsView = lazy(async () =>
  import('@/features/settings/SettingsView').then((module) => ({
    default: module.SettingsView,
  })),
);

function quickAddPlacementForPath(
  pathname: string,
): 'today' | 'upcoming' | null {
  if (pathname === '/now') {
    return 'today';
  }

  if (pathname === '/upcoming') {
    return 'upcoming';
  }

  return null;
}

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
  const shouldShowSessionRecovery =
    Boolean(snapshot) &&
    auth.configured &&
    auth.isReady &&
    shouldShowRecoveryPanel(snapshot.syncState, Boolean(auth.session));
  const shouldShowLanding = shouldShowAuthLanding({
    authConfigured: auth.configured,
    authReady: auth.isReady,
    hasLocalData,
    hasSession: Boolean(auth.session),
    shouldShowSessionRecovery,
    snapshotReady: Boolean(snapshot),
  });

  if (location.pathname === '/auth/callback') {
    return <AuthCallbackView />;
  }

  if (!snapshot) {
    return <LoadingPanel layout="screen" />;
  }

  if (shouldWaitForAuthGate) {
    return <LoadingPanel layout="auth" />;
  }

  if (shouldShowLanding) {
    return <AuthLandingView nextPath={location.pathname} />;
  }

  return (
    <>
      <AppShell
        currentDate={currentDate}
        onAdd={() => setQuickAddOpen(true)}
        onChangeDate={setCurrentDate}
        onOpenSettings={() => navigate('/settings')}
        openCount={openItems(snapshot.items).length}
        showDateControls={
          location.pathname !== '/inbox' && location.pathname !== '/settings'
        }
        viewPath={location.pathname}
      >
        {shouldShowSessionRecovery && location.pathname !== '/settings' ? (
          <AuthRecoveryPanel
            nextPath={location.pathname}
            reason={snapshot.syncState.authPromptState}
          />
        ) : null}
        <Suspense fallback={<LoadingPanel />}>
          <Routes>
            <Route path="/" element={<Navigate replace to="/now" />} />
            <Route path="/today" element={<Navigate replace to="/now" />} />
            <Route
              path="/now"
              element={
                <NowView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/inbox"
              element={
                <InboxView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/upcoming"
              element={
                <UpcomingView
                  currentDate={currentDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/review"
              element={
                <ReviewView
                  currentDate={currentDate}
                  onJumpToDate={(date) => {
                    setCurrentDate(date);
                    navigate('/now');
                  }}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsView currentDate={currentDate} snapshot={snapshot} />
              }
            />
          </Routes>
        </Suspense>
      </AppShell>
      <QuickAddDialog
        currentDate={currentDate}
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        preferredPlacement={quickAddPlacementForPath(location.pathname)}
      />
      {selectedItem ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <AppRoutes />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
