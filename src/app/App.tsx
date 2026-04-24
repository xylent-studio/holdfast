import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { AuthCallbackView } from '@/app/auth/AuthCallbackView';
import { shouldShowAuthLanding } from '@/app/auth/gating';
import { AuthLandingView } from '@/app/auth/AuthLandingView';
import { AuthProvider } from '@/app/auth/AuthProvider';
import { AuthRecoveryPanel } from '@/app/auth/AuthRecoveryPanel';
import { shouldShowSessionRecovery as shouldShowRecoveryPanel } from '@/app/auth/recovery';
import { useAuth } from '@/app/auth/useAuth';
import { AppRecoveryScreen } from '@/app/runtime/AppRecoveryScreen';
import { RuntimeErrorBoundary } from '@/app/runtime/RuntimeErrorBoundary';
import { clearRuntimeRecoveryAttempt } from '@/app/runtime/runtime-recovery';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { SyncProvider } from '@/app/sync/SyncProvider';
import { AppShell } from '@/app/shell/AppShell';
import { QuickAddDialog } from '@/features/capture/QuickAddDialog';
import { NowView } from '@/features/now/NowView';
import { UpcomingView } from '@/features/upcoming/UpcomingView';
import { todayDateKey } from '@/domain/dates';
import {
  addContextForLocation,
  currentListIdForPath,
} from '@/domain/logic/capture';
import { type HoldfastSnapshot, useHoldfastSnapshotState } from '@/storage/local/api';
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
const ListView = lazy(async () =>
  import('@/features/lists/ListView').then((module) => ({
    default: module.ListView,
  })),
);
const ListsHomeView = lazy(async () =>
  import('@/features/lists/ListsHomeView').then((module) => ({
    default: module.ListsHomeView,
  })),
);
const SettingsView = lazy(async () =>
  import('@/features/settings/SettingsView').then((module) => ({
    default: module.SettingsView,
  })),
);

async function preloadCoreOfflineSurface(): Promise<void> {
  await import('@/features/item-details/ItemDetailsDialog');
}

function RoutedListView({
  currentDate,
  highlightListItemId,
  onOpenItem,
  snapshot,
}: {
  currentDate: string;
  highlightListItemId: string | null;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}) {
  const params = useParams<{ listId: string }>();
  if (!params.listId) {
    return <Navigate replace to="/review" />;
  }

  return (
    <ListView
      currentDate={currentDate}
      highlightListItemId={highlightListItemId}
      listId={params.listId}
      onOpenItem={onOpenItem}
      snapshot={snapshot}
    />
  );
}

function AppRoutes() {
  const today = todayDateKey();
  const [nowDate, setNowDate] = useState(today);
  const [upcomingDate, setUpcomingDate] = useState(today);
  const [listRouteDate, setListRouteDate] = useState(today);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const routeDate =
    location.pathname === '/now'
      ? nowDate
      : location.pathname === '/upcoming'
        ? upcomingDate
        : location.pathname.startsWith('/lists/')
          ? listRouteDate
          : todayDateKey();
  const snapshotState = useHoldfastSnapshotState(routeDate);
  const snapshot = snapshotState.snapshot;

  useEffect(() => {
    void preloadCoreOfflineSurface();
  }, []);

  useEffect(() => {
    if (snapshotState.status === 'ready') {
      clearRuntimeRecoveryAttempt();
    }
  }, [snapshotState.status]);

  const selectedItem = useMemo(
    () => snapshot?.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, snapshot?.items],
  );
  const quickAddContext = addContextForLocation(
    location.pathname,
    location.search,
  );
  const currentListId = currentListIdForPath(location.pathname);
  const openList = (
    listId: string,
    highlightListItemId?: string | null,
    contextDate: string = todayDateKey(),
  ): void => {
    const nextSearchParams = new URLSearchParams();
    if (highlightListItemId) {
      nextSearchParams.set('item', highlightListItemId);
    }

    setListRouteDate(contextDate);
    const suffix = nextSearchParams.toString();
    navigate(`/lists/${listId}${suffix ? `?${suffix}` : ''}`);
  };
  const changeRouteDate = (value: string): void => {
    if (location.pathname === '/upcoming') {
      setUpcomingDate(value);
      return;
    }

    setNowDate(value);
  };
  const hasLocalData = snapshot ? hasMeaningfulLocalState(snapshot) : false;
  const shouldWaitForAuthGate =
    Boolean(snapshot) && auth.configured && !auth.isReady && !hasLocalData;
  const shouldShowSessionRecovery =
    Boolean(snapshot) &&
    auth.configured &&
    auth.isReady &&
    shouldShowRecoveryPanel(snapshot.workspaceState, Boolean(auth.session));
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

  if (snapshotState.status === 'error') {
    return (
      <AppRecoveryScreen
        error={
          snapshotState.error ?? new Error('Holdfast could not open this device workspace.')
        }
        mode="storage"
        onRetry={snapshotState.retry}
      />
    );
  }

  if (snapshotState.status !== 'ready' || !snapshot) {
    return <LoadingPanel layout="screen" />;
  }

  if (shouldWaitForAuthGate) {
    return <LoadingPanel layout="auth" />;
  }

  if (shouldShowLanding) {
    return <AuthLandingView nextPath={location.pathname} />;
  }

  return (
    <RuntimeErrorBoundary
      fallback={(error) => <AppRecoveryScreen error={error} mode="runtime" />}
    >
        <AppShell
          currentDate={routeDate}
          onAdd={() => setQuickAddOpen(true)}
          onChangeDate={changeRouteDate}
          onOpenListsHome={() => navigate('/lists')}
          onOpenSettings={() => navigate('/settings')}
          showDateControls={
            location.pathname === '/now' || location.pathname === '/upcoming'
          }
          viewPath={location.pathname}
        >
        {shouldShowSessionRecovery && location.pathname !== '/settings' ? (
          <AuthRecoveryPanel
            nextPath={location.pathname}
            reason={snapshot.workspaceState.authPromptState}
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
                  currentDate={nowDate}
                  onOpenItem={setSelectedItemId}
                  onOpenList={(listId, highlightListItemId) =>
                    openList(listId, highlightListItemId, nowDate)
                  }
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/inbox"
              element={
                <InboxView
                  currentDate={routeDate}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/upcoming"
              element={
                <UpcomingView
                  currentDate={upcomingDate}
                  onOpenItem={setSelectedItemId}
                  onOpenList={(listId, highlightListItemId) =>
                    openList(listId, highlightListItemId, upcomingDate)
                  }
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/review"
              element={
                <ReviewView
                  currentDate={routeDate}
                  onJumpToDate={(date) => {
                    setNowDate(date);
                    navigate('/now');
                  }}
                  onOpenItem={setSelectedItemId}
                  onOpenList={(listId, highlightListItemId) =>
                    openList(listId, highlightListItemId, todayDateKey())
                  }
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/lists"
              element={
                <ListsHomeView
                  onOpenList={(listId) => openList(listId, null, todayDateKey())}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/lists/:listId"
              element={
                <RoutedListView
                  currentDate={routeDate}
                  highlightListItemId={searchParams.get('item')}
                  onOpenItem={setSelectedItemId}
                  snapshot={snapshot}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsView currentDate={routeDate} snapshot={snapshot} />
              }
            />
          </Routes>
        </Suspense>
      </AppShell>
      <QuickAddDialog
        context={quickAddContext}
        currentDate={routeDate}
        currentListId={currentListId}
        isOpen={quickAddOpen}
        lists={snapshot.lists}
        onClose={() => setQuickAddOpen(false)}
        onOpenList={openList}
      />
      {selectedItem ? (
        <Suspense fallback={null}>
          <ItemDetailsDialog
            currentDate={routeDate}
            isFocused={Boolean(
              snapshot.currentDay.focusItemIds.includes(selectedItem.id),
            )}
            item={selectedItem}
            isOpen
            key={`${selectedItem.id}-${selectedItem.updatedAt}`}
            lists={snapshot.lists}
            onClose={() => setSelectedItemId(null)}
            onOpenList={openList}
          />
        </Suspense>
      ) : null}
    </RuntimeErrorBoundary>
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
