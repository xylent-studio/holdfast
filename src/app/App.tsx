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
import { GuestStatusNotice } from '@/app/auth/GuestStatusNotice';
import {
  resolveShellAccessMode,
  shouldWaitForShellAccess,
} from '@/app/auth/gating';
import { AuthProvider } from '@/app/auth/AuthProvider';
import { AuthRecoveryPanel } from '@/app/auth/AuthRecoveryPanel';
import { useAuth } from '@/app/auth/useAuth';
import { AppRecoveryScreen } from '@/app/runtime/AppRecoveryScreen';
import { RuntimeErrorBoundary } from '@/app/runtime/RuntimeErrorBoundary';
import { clearRuntimeRecoveryAttempt } from '@/app/runtime/runtime-recovery';
import { AppShell } from '@/app/shell/AppShell';
import { SyncProvider } from '@/app/sync/SyncProvider';
import { todayDateKey } from '@/domain/dates';
import {
  addContextForLocation,
  currentListIdForPath,
} from '@/domain/logic/capture';
import type { ItemSurfaceContext } from '@/domain/logic/surface-actions';
import { QuickAddDialog } from '@/features/capture/QuickAddDialog';
import { NowView } from '@/features/now/NowView';
import { UpcomingView } from '@/features/upcoming/UpcomingView';
import {
  type HoldfastSnapshot,
  useHoldfastSnapshotState,
} from '@/storage/local/api';
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
  onOpenItem: (itemId: string, origin: ItemSurfaceContext) => void;
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
  const [selectedItemState, setSelectedItemState] = useState<{
    itemId: string;
    origin: ItemSurfaceContext;
  } | null>(null);
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
    () =>
      snapshot?.items.find((item) => item.id === selectedItemState?.itemId) ?? null,
    [selectedItemState?.itemId, snapshot?.items],
  );
  const selectedItemOrigin = selectedItemState?.origin ?? null;
  const quickAddContext = addContextForLocation(
    location.pathname,
    location.search,
  );
  const currentListId = currentListIdForPath(location.pathname);
  const nextPath = `${location.pathname}${location.search}`;

  const openItem = (itemId: string, origin: ItemSurfaceContext): void => {
    setSelectedItemState({ itemId, origin });
  };

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

  if (location.pathname === '/auth/callback') {
    return <AuthCallbackView />;
  }

  if (snapshotState.status === 'error') {
    return (
      <AppRecoveryScreen
        error={
          snapshotState.error ??
          new Error('Holdfast could not open this device workspace.')
        }
        mode="storage"
        onRetry={snapshotState.retry}
      />
    );
  }

  if (snapshotState.status !== 'ready' || !snapshot) {
    return <LoadingPanel layout="screen" />;
  }

  const shouldWaitForAuthGate = shouldWaitForShellAccess({
    authConfigured: auth.configured,
    authReady: auth.isReady,
    snapshotReady: true,
    workspaceState: snapshot.workspaceState,
  });
  const shellAccessMode = resolveShellAccessMode({
    authConfigured: auth.configured,
    authReady: auth.isReady,
    hasSession: Boolean(auth.session),
    path: location.pathname,
    snapshotReady: true,
    workspaceState: snapshot.workspaceState,
  });

  if (shouldWaitForAuthGate) {
    return <LoadingPanel layout="auth" />;
  }

  const showGuestStatusNotice =
    shellAccessMode === 'guest-shell' &&
    auth.configured &&
    auth.isReady &&
    !auth.session &&
    location.pathname !== '/settings';
  const showRecoveryPanel =
    shellAccessMode === 'member-recovery' && location.pathname !== '/settings';
  const blockForWrongAccount =
    shellAccessMode === 'wrong-account-recovery' &&
    location.pathname !== '/settings';

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
        {showGuestStatusNotice ? <GuestStatusNotice nextPath={nextPath} /> : null}
        {showRecoveryPanel || blockForWrongAccount ? (
          <AuthRecoveryPanel
            nextPath={nextPath}
            reason={snapshot.workspaceState.authPromptState}
          />
        ) : null}
        {!blockForWrongAccount ? (
          <Suspense fallback={<LoadingPanel />}>
            <Routes>
              <Route path="/" element={<Navigate replace to="/now" />} />
              <Route path="/today" element={<Navigate replace to="/now" />} />
              <Route
                path="/now"
                element={
                  <NowView
                    currentDate={nowDate}
                    onOpenItem={openItem}
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
                    onOpenItem={openItem}
                    snapshot={snapshot}
                  />
                }
              />
              <Route
                path="/upcoming"
                element={
                  <UpcomingView
                    currentDate={upcomingDate}
                    onOpenItem={openItem}
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
                    onOpenItem={openItem}
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
                    onOpenItem={openItem}
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
        ) : null}
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
            isFocused={Boolean(snapshot.currentDay.focusItemIds.includes(selectedItem.id))}
            isOpen
            item={selectedItem}
            key={selectedItem.id}
            lists={snapshot.lists}
            onClose={() => setSelectedItemState(null)}
            onOpenList={openList}
            origin={selectedItemOrigin ?? { route: 'review' }}
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
