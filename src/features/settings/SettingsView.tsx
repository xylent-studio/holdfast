import { Suspense, lazy, useState } from 'react';

import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import { useRuntimeDiagnostics } from '@/app/runtime/useRuntimeDiagnostics';
import { useAuth } from '@/app/auth/useAuth';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { useSync } from '@/app/sync/useSync';
import type { SettingsRecord, WeeklyRecord } from '@/domain/schemas/records';
import type { DateKey } from '@/domain/dates';
import {
  conflictedItems,
  conflictedListItems,
  conflictedLists,
  currentWeekLabel,
} from '@/domain/logic/selectors';
import { deriveSyncHealth } from '@/domain/logic/sync';
import {
  removeDataFromDevice,
  updateSettings,
  updateWeeklyRecord,
} from '@/storage/local/api';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { Panel } from '@/shared/ui/Panel';

import { ExpandablePanel } from './ExpandablePanel';
import { RoutineSetupPanel } from './RoutineSetupPanel';

const PrototypeRecoveryPanel = lazy(async () =>
  import('@/features/settings/PrototypeRecoveryPanel').then((module) => ({
    default: module.PrototypeRecoveryPanel,
  })),
);
const WorkspaceBackupPanel = lazy(async () =>
  import('@/features/settings/WorkspaceBackupPanel').then((module) => ({
    default: module.WorkspaceBackupPanel,
  })),
);

interface SettingsViewProps {
  currentDate: DateKey;
  snapshot: HoldfastSnapshot;
}

interface LongerViewEditorProps {
  settings: SettingsRecord;
}

interface WeeklyEditorProps {
  currentDate: DateKey;
  weeklyRecord: WeeklyRecord;
}

interface LongerViewDraft {
  direction: string;
  standards: string;
  why: string;
}

interface WeeklyDraft {
  focus: string;
  notes: string;
  protect: string;
}

interface DraftState<TDraft> {
  base: TDraft;
  draft: TDraft;
}

function summarizeText(...values: string[]): string {
  const summary = values.find((value) => value.trim())?.trim() ?? 'Nothing set yet.';
  return summary.length > 120 ? `${summary.slice(0, 117).trimEnd()}...` : summary;
}

function buildLongerViewDraft(settings: SettingsRecord): LongerViewDraft {
  return {
    direction: settings.direction,
    standards: settings.standards,
    why: settings.why,
  };
}

function sameLongerViewDraft(
  left: LongerViewDraft,
  right: LongerViewDraft,
): boolean {
  return (
    left.direction === right.direction &&
    left.standards === right.standards &&
    left.why === right.why
  );
}

function buildWeeklyDraft(weeklyRecord: WeeklyRecord): WeeklyDraft {
  return {
    focus: weeklyRecord.focus,
    notes: weeklyRecord.notes,
    protect: weeklyRecord.protect,
  };
}

function sameWeeklyDraft(left: WeeklyDraft, right: WeeklyDraft): boolean {
  return (
    left.focus === right.focus &&
    left.notes === right.notes &&
    left.protect === right.protect
  );
}

function LongerViewEditor({ settings }: LongerViewEditorProps) {
  const incomingDraft = buildLongerViewDraft(settings);
  const [draftState, setDraftState] = useState<DraftState<LongerViewDraft>>(
    () => ({
      base: incomingDraft,
      draft: incomingDraft,
    }),
  );
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );
  const wasDirty = !sameLongerViewDraft(draftState.draft, draftState.base);
  const hasIncomingRefresh = !sameLongerViewDraft(incomingDraft, draftState.base);

  if (hasIncomingRefresh) {
    setDraftState({
      base: incomingDraft,
      draft: wasDirty ? draftState.draft : incomingDraft,
    });
  }

  const activeBase = hasIncomingRefresh ? incomingDraft : draftState.base;
  const activeDraft =
    hasIncomingRefresh && !wasDirty ? incomingDraft : draftState.draft;
  const dirty = !sameLongerViewDraft(activeDraft, activeBase);

  const handleSave = async (): Promise<void> => {
    if (!dirty) {
      return;
    }

    setSaveState('saving');
    await updateSettings(activeDraft);
    setDraftState({
      base: activeDraft,
      draft: activeDraft,
    });
    setSaveState('saved');
  };

  return (
    <>
      <div className="grid two">
        <label className="field-stack">
          <span>12-month direction</span>
          <textarea
            aria-label="12-month direction"
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  direction: event.target.value,
                },
              }));
            }}
            rows={4}
            value={activeDraft.direction}
          />
        </label>
        <label className="field-stack">
          <span>Non-negotiables</span>
          <textarea
            aria-label="Non-negotiables"
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  standards: event.target.value,
                },
              }));
            }}
            rows={4}
            value={activeDraft.standards}
          />
        </label>
      </div>
      <label className="field-stack">
        <span>Why this matters</span>
        <textarea
          aria-label="Why this matters"
          onChange={(event) => {
            setSaveState('idle');
            setDraftState((current) => ({
              ...current,
              draft: {
                ...(dirty ? current.draft : activeDraft),
                why: event.target.value,
              },
            }));
          }}
          rows={4}
          value={activeDraft.why}
        />
      </label>
      <div className="dialog-actions">
        {saveState === 'saved' && !dirty ? (
          <span className="form-status">Saved</span>
        ) : null}
        <button
          className="button ghost"
          disabled={!dirty}
          onClick={() => {
            setDraftState((current) => ({
              ...current,
              draft: current.base,
            }));
            setSaveState('idle');
          }}
          type="button"
        >
          Cancel
        </button>
        <button
          className="button accent"
          disabled={!dirty || saveState === 'saving'}
          onClick={() => void handleSave()}
          type="button"
        >
          {saveState === 'saving' ? 'Saving...' : 'Save'}
        </button>
      </div>
    </>
  );
}

function WeeklyEditor({ currentDate, weeklyRecord }: WeeklyEditorProps) {
  const incomingDraft = buildWeeklyDraft(weeklyRecord);
  const [draftState, setDraftState] = useState<DraftState<WeeklyDraft>>(() => ({
    base: incomingDraft,
    draft: incomingDraft,
  }));
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );
  const wasDirty = !sameWeeklyDraft(draftState.draft, draftState.base);
  const hasIncomingRefresh = !sameWeeklyDraft(incomingDraft, draftState.base);

  if (hasIncomingRefresh) {
    setDraftState({
      base: incomingDraft,
      draft: wasDirty ? draftState.draft : incomingDraft,
    });
  }

  const activeBase = hasIncomingRefresh ? incomingDraft : draftState.base;
  const activeDraft =
    hasIncomingRefresh && !wasDirty ? incomingDraft : draftState.draft;
  const dirty = !sameWeeklyDraft(activeDraft, activeBase);

  const handleSave = async (): Promise<void> => {
    if (!dirty) {
      return;
    }

    setSaveState('saving');
    await updateWeeklyRecord(currentDate, activeDraft);
    setDraftState({
      base: activeDraft,
      draft: activeDraft,
    });
    setSaveState('saved');
  };

  return (
    <>
      <div className="grid two">
        <label className="field-stack">
          <span>Week focus</span>
          <textarea
            aria-label="Week focus"
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  focus: event.target.value,
                },
              }));
            }}
            rows={4}
            value={activeDraft.focus}
          />
        </label>
        <label className="field-stack">
          <span>Protect</span>
          <textarea
            aria-label="Protect"
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  protect: event.target.value,
                },
              }));
            }}
            rows={4}
            value={activeDraft.protect}
          />
        </label>
      </div>
      <label className="field-stack">
        <span>Notes</span>
        <textarea
          aria-label="Notes"
          onChange={(event) => {
            setSaveState('idle');
            setDraftState((current) => ({
              ...current,
              draft: {
                ...(dirty ? current.draft : activeDraft),
                notes: event.target.value,
              },
            }));
          }}
          rows={4}
          value={activeDraft.notes}
        />
      </label>
      <div className="dialog-actions">
        {saveState === 'saved' && !dirty ? (
          <span className="form-status">Saved</span>
        ) : null}
        <button
          className="button ghost"
          disabled={!dirty}
          onClick={() => {
            setDraftState((current) => ({
              ...current,
              draft: current.base,
            }));
            setSaveState('idle');
          }}
          type="button"
        >
          Cancel
        </button>
        <button
          className="button accent"
          disabled={!dirty || saveState === 'saving'}
          onClick={() => void handleSave()}
          type="button"
        >
          {saveState === 'saving' ? 'Saving...' : 'Save'}
        </button>
      </div>
    </>
  );
}

export function SettingsView({ currentDate, snapshot }: SettingsViewProps) {
  const auth = useAuth();
  const sync = useSync();
  const runtime = useRuntimeDiagnostics();
  const localDataExists = hasMeaningfulLocalState(snapshot);
  const deviceWorkspaceExists =
    localDataExists || snapshot.workspaceState.ownershipState === 'member';
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [workspaceSafetyOpen, setWorkspaceSafetyOpen] = useState(false);
  const [privateNotesOpen, setPrivateNotesOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [removeDataBusy, setRemoveDataBusy] = useState(false);
  const [removeDataFeedback, setRemoveDataFeedback] = useState<string | null>(
    null,
  );
  const routineSummary = snapshot.routines.length
    ? `${snapshot.routines.length} routine${
        snapshot.routines.length === 1 ? '' : 's'
      } ready to review.`
    : 'No custom routines yet.';
  const privateNotesSummary = summarizeText(
    snapshot.settings.direction,
    snapshot.settings.standards,
    snapshot.settings.why,
    snapshot.weeklyRecord.focus,
    snapshot.weeklyRecord.protect,
    snapshot.weeklyRecord.notes,
  );
  const isDetachedRestore =
    snapshot.workspaceState.attachState === 'detached-restore';
  const hasConflictAttention =
    conflictedItems(snapshot.items).length > 0 ||
    conflictedLists(snapshot.lists).length > 0 ||
    conflictedListItems(snapshot.listItems).length > 0;
  const syncHealth = deriveSyncHealth({
    configured: auth.configured,
    failedMutationCount: sync.failedMutationCount,
    hasConflictAttention,
    isOnline: sync.isOnline,
    pendingMutationCount: sync.pendingMutationCount,
    signedIn: Boolean(auth.session),
    syncState: snapshot.syncState,
    workspaceState: snapshot.workspaceState,
  });
  const deviceStatus =
    auth.session && snapshot.workspaceState.attachState === 'attached'
      ? 'Attached to your account'
      : snapshot.workspaceState.ownershipState === 'member'
        ? 'Waiting for sign-in'
        : 'Guest on this device';
  const localSafetyLabel = deviceWorkspaceExists
    ? 'Safe on this device'
    : 'Nothing local yet';
  const syncHistoryLabel = snapshot.syncState.lastSyncedAt ?? 'Not yet';

  const handleRemoveDataFromDevice = async (): Promise<void> => {
    const confirmed = window.confirm(
      auth.session
        ? 'Remove data from this device?\n\nThis signs you out here and removes local items, lists, attachments, backups, and settings from this device only.'
        : 'Remove data from this device?\n\nThis clears local items, lists, attachments, backups, and settings from this device only.',
    );
    if (!confirmed) {
      return;
    }

    setRemoveDataFeedback(null);
    setRemoveDataBusy(true);
    try {
      if (auth.session) {
        await auth.signOut();
      }
      await removeDataFromDevice();
      setRemoveDataFeedback('This device is empty again.');
    } finally {
      setRemoveDataBusy(false);
    }
  };

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <h1>Account</h1>
          <p>
            {isDetachedRestore
              ? auth.session
                ? 'This restored workspace is attached here and still catching up.'
                : 'This restored workspace is safe on this device. Sign in when you want it attached for sync.'
              : auth.session
              ? 'Stay signed in quietly and let Holdfast catch up in the background.'
              : snapshot.workspaceState.authPromptState === 'account-mismatch'
                ? "This device is still holding another account's workspace."
                : snapshot.workspaceState.ownershipState === 'member'
                  ? 'Sign in again to keep this device in sync.'
                  : 'Use Holdfast locally now. Sign in when you want this device attached for sync.'}
          </p>
        </div>
        <div className="account-stack">
          <div className="account-row">
            <span>Status</span>
            <strong>{syncHealth.label}</strong>
          </div>
          <p>{syncHealth.detail}</p>
          <div className="account-row">
            <span>Local data</span>
            <strong>{localSafetyLabel}</strong>
          </div>
          <div className="account-row">
            <span>This device</span>
            <strong>{deviceStatus}</strong>
          </div>
          <div className="account-row">
            <span>Sync history</span>
            <strong>{syncHistoryLabel}</strong>
          </div>
          {auth.session ? (
            <>
              <div className="account-row">
                <span>Email</span>
                <strong>{auth.email ?? 'Signed in'}</strong>
              </div>
              {auth.displayName ? (
                <div className="account-row">
                  <span>Name</span>
                  <strong>{auth.displayName}</strong>
                </div>
              ) : null}
              {auth.providerLabel ? (
                <div className="account-row">
                  <span>Provider</span>
                  <strong>{auth.providerLabel}</strong>
                </div>
              ) : null}
              <div className="dialog-actions">
                {syncHealth.state === 'degraded' ? (
                  <button
                    className="button ghost"
                    onClick={() => void sync.retrySync()}
                    type="button"
                  >
                    Retry
                  </button>
                ) : null}
                <button
                  className="button ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Sign out on this device?\n\nLocal work will stay here.',
                      )
                    ) {
                      void auth.signOut();
                    }
                  }}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <AuthAccessActions
              hasLocalData={deviceWorkspaceExists}
              nextPath="/settings"
            />
          )}
        </div>
      </Panel>

      <ExpandablePanel
        description="Optional longer-view notes, kept out of the way."
        isOpen={privateNotesOpen}
        onToggle={() => setPrivateNotesOpen((current) => !current)}
        summary={privateNotesSummary}
        title="Private notes"
      >
        <div className="stack">
          <div className="stack compact">
            <div className="eyebrow">Longer view</div>
            <LongerViewEditor
              key={snapshot.settings.id}
              settings={snapshot.settings}
            />
          </div>
          <div className="stack compact">
            <div className="eyebrow">{currentWeekLabel(currentDate)}</div>
            <WeeklyEditor
              currentDate={currentDate}
              key={snapshot.weeklyRecord.weekStart}
              weeklyRecord={snapshot.weeklyRecord}
            />
          </div>
        </div>
      </ExpandablePanel>

      <ExpandablePanel
        description="Recurring things Holdfast should bring into Now or Upcoming."
        isOpen={routineOpen}
        onToggle={() => setRoutineOpen((current) => !current)}
        summary={routineSummary}
        title="Routines"
      >
        <RoutineSetupPanel routines={snapshot.routines} />
      </ExpandablePanel>

      <ExpandablePanel
        description="Backup this workspace or recover earlier local work when you need to."
        isOpen={workspaceSafetyOpen}
        onToggle={() => setWorkspaceSafetyOpen((current) => !current)}
        summary={
          isDetachedRestore
            ? 'This restored workspace stays local until you sign in.'
            : 'Back up this device or recover earlier prototype work.'
        }
        title="Device recovery"
      >
        <Suspense fallback={<div className="empty-inline">Loading tools...</div>}>
          <div className="stack">
            <WorkspaceBackupPanel
              attachUserId={auth.user?.id ?? null}
              onRestoreComplete={() => void sync.retrySync()}
            />
            <PrototypeRecoveryPanel />
            <div className="recovery-note">
              <strong>Remove data from this device</strong>
              <p>
                Sign out here and clear local items, lists, attachments, and
                backup history from this device without deleting your account.
              </p>
              <div className="dialog-actions">
                <button
                  className="button danger"
                  disabled={removeDataBusy}
                  onClick={() => void handleRemoveDataFromDevice()}
                  type="button"
                >
                  {removeDataBusy
                    ? 'Removing...'
                    : 'Remove data from this device'}
                </button>
              </div>
              {removeDataFeedback ? (
                <p className="form-status">{removeDataFeedback}</p>
              ) : null}
            </div>
          </div>
        </Suspense>
      </ExpandablePanel>

      <ExpandablePanel
        description="Small runtime and sync details for support and release verification."
        isOpen={diagnosticsOpen}
        onToggle={() => setDiagnosticsOpen((current) => !current)}
        summary={`${runtime.buildId} / ${syncHealth.state}`}
        title="Support details"
      >
        <div className="account-stack">
          <div className="account-row">
            <span>Build</span>
            <strong>{runtime.buildId}</strong>
          </div>
          <div className="account-row">
            <span>Service worker</span>
            <strong>{runtime.activeServiceWorkerBuildId ?? 'Not active yet'}</strong>
          </div>
          <div className="account-row">
            <span>Supabase</span>
            <strong>{runtime.supabaseHost ?? 'Not configured'}</strong>
          </div>
          <div className="account-row">
            <span>Sync posture</span>
            <strong>{syncHealth.state}</strong>
          </div>
          <div className="account-row">
            <span>Blocked reason</span>
            <strong>{snapshot.syncState.blockedReason ?? 'None'}</strong>
          </div>
          <div className="account-row">
            <span>Pending changes</span>
            <strong>{sync.pendingMutationCount}</strong>
          </div>
          <div className="account-row">
            <span>Failed changes</span>
            <strong>{sync.failedMutationCount}</strong>
          </div>
          <div className="account-row">
            <span>Last sync issue</span>
            <strong>{snapshot.syncState.lastTransportError ?? 'None'}</strong>
          </div>
          <div className="account-row">
            <span>Last failure</span>
            <strong>{snapshot.syncState.lastFailureAt ?? 'None'}</strong>
          </div>
          <div className="account-row">
            <span>Last synced</span>
            <strong>{snapshot.syncState.lastSyncedAt ?? 'Not yet'}</strong>
          </div>
        </div>
      </ExpandablePanel>
    </div>
  );
}
