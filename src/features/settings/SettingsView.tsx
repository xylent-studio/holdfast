import { Suspense, lazy, useState } from 'react';

import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import { useAuth } from '@/app/auth/useAuth';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { useSync } from '@/app/sync/useSync';
import type { DateKey } from '@/domain/dates';
import { currentWeekLabel } from '@/domain/logic/selectors';
import { updateSettings, updateWeeklyRecord } from '@/storage/local/api';
import type { HoldfastSnapshot } from '@/storage/local/api';
import type { SettingsRecord, WeeklyRecord } from '@/domain/schemas/records';
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

function summarizeText(...values: string[]): string {
  const summary = values.find((value) => value.trim())?.trim() ?? 'Nothing set yet.';
  return summary.length > 120 ? `${summary.slice(0, 117).trimEnd()}...` : summary;
}

function syncStatusLabel(
  configured: boolean,
  signedIn: boolean,
  isOnline: boolean,
  pendingMutationCount: number,
  syncMode: HoldfastSnapshot['syncState']['mode'],
  authPromptState: HoldfastSnapshot['syncState']['authPromptState'],
  identityState: HoldfastSnapshot['syncState']['identityState'],
): string {
  if (!configured) {
    return 'Account setup is off in this build.';
  }

  if (signedIn) {
    if (syncMode === 'syncing') {
      return 'Syncing...';
    }

    if (syncMode === 'error') {
      return "Couldn't sync yet";
    }

    if (!isOnline || pendingMutationCount > 0) {
      return 'Saved offline';
    }

    return 'Up to date';
  }

  if (authPromptState === 'account-mismatch') {
    return 'Needs the original account';
  }

  return identityState === 'member'
    ? 'Signed out on this device'
    : 'Not signed in';
}

function LongerViewEditor({ settings }: LongerViewEditorProps) {
  const [direction, setDirection] = useState(settings.direction);
  const [standards, setStandards] = useState(settings.standards);
  const [why, setWhy] = useState(settings.why);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );
  const dirty =
    direction !== settings.direction ||
    standards !== settings.standards ||
    why !== settings.why;

  const handleSave = async (): Promise<void> => {
    if (!dirty) {
      return;
    }

    setSaveState('saving');
    await updateSettings({ direction, standards, why });
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
              setDirection(event.target.value);
            }}
            rows={4}
            value={direction}
          />
        </label>
        <label className="field-stack">
          <span>Non-negotiables</span>
          <textarea
            aria-label="Non-negotiables"
            onChange={(event) => {
              setSaveState('idle');
              setStandards(event.target.value);
            }}
            rows={4}
            value={standards}
          />
        </label>
      </div>
      <label className="field-stack">
        <span>Why this matters</span>
        <textarea
          aria-label="Why this matters"
          onChange={(event) => {
            setSaveState('idle');
            setWhy(event.target.value);
          }}
          rows={4}
          value={why}
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
            setDirection(settings.direction);
            setStandards(settings.standards);
            setWhy(settings.why);
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
  const [focus, setFocus] = useState(weeklyRecord.focus);
  const [protect, setProtect] = useState(weeklyRecord.protect);
  const [notes, setNotes] = useState(weeklyRecord.notes);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );
  const dirty =
    focus !== weeklyRecord.focus ||
    protect !== weeklyRecord.protect ||
    notes !== weeklyRecord.notes;

  const handleSave = async (): Promise<void> => {
    if (!dirty) {
      return;
    }

    setSaveState('saving');
    await updateWeeklyRecord(currentDate, { focus, notes, protect });
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
              setFocus(event.target.value);
            }}
            rows={4}
            value={focus}
          />
        </label>
        <label className="field-stack">
          <span>Protect</span>
          <textarea
            aria-label="Protect"
            onChange={(event) => {
              setSaveState('idle');
              setProtect(event.target.value);
            }}
            rows={4}
            value={protect}
          />
        </label>
      </div>
      <label className="field-stack">
        <span>Notes</span>
        <textarea
          aria-label="Notes"
          onChange={(event) => {
            setSaveState('idle');
            setNotes(event.target.value);
          }}
          rows={4}
          value={notes}
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
            setFocus(weeklyRecord.focus);
            setProtect(weeklyRecord.protect);
            setNotes(weeklyRecord.notes);
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
  const localDataExists = hasMeaningfulLocalState(snapshot);
  const deviceWorkspaceExists =
    localDataExists || snapshot.syncState.identityState === 'member';
  const [workspaceSafetyOpen, setWorkspaceSafetyOpen] = useState(false);
  const [longerViewOpen, setLongerViewOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const routineSummary = snapshot.routines.length
    ? `${snapshot.routines.length} routine${
        snapshot.routines.length === 1 ? '' : 's'
      } ready to review.`
    : 'No custom routines yet.';

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <h1>Account</h1>
          <p>
            {auth.session
              ? 'Stay signed in quietly and let Holdfast catch up in the background.'
              : snapshot.syncState.authPromptState === 'account-mismatch'
                ? "This device is still holding another account's workspace."
                : snapshot.syncState.identityState === 'member'
                  ? 'Sign in again to keep this device in sync.'
                  : 'Sign in once and pick back up anywhere.'}
          </p>
        </div>
        <div className="account-stack">
          <div className="account-row">
            <span>Status</span>
            <strong>
              {syncStatusLabel(
                auth.configured,
                Boolean(auth.session),
                sync.isOnline,
                sync.pendingMutationCount,
                snapshot.syncState.mode,
                snapshot.syncState.authPromptState,
                snapshot.syncState.identityState,
              )}
            </strong>
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
                {snapshot.syncState.mode === 'error' ||
                sync.pendingMutationCount > 0 ? (
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
        description="Keep only the longer-view notes that actually help."
        isOpen={longerViewOpen}
        onToggle={() => setLongerViewOpen((current) => !current)}
        summary={summarizeText(
          snapshot.settings.direction,
          snapshot.settings.standards,
          snapshot.settings.why,
        )}
        title="Longer view"
      >
        <LongerViewEditor
          key={snapshot.settings.updatedAt}
          settings={snapshot.settings}
        />
      </ExpandablePanel>

      <ExpandablePanel
        description={currentWeekLabel(currentDate)}
        isOpen={weeklyOpen}
        onToggle={() => setWeeklyOpen((current) => !current)}
        summary={
          summarizeText(
            snapshot.weeklyRecord.focus,
            snapshot.weeklyRecord.protect,
            snapshot.weeklyRecord.notes,
          ) === 'Nothing set yet.'
            ? `${currentWeekLabel(currentDate)}. Nothing set yet.`
            : summarizeText(
                snapshot.weeklyRecord.focus,
                snapshot.weeklyRecord.protect,
                snapshot.weeklyRecord.notes,
              )
        }
        title="This week"
      >
        <WeeklyEditor
          currentDate={currentDate}
          key={snapshot.weeklyRecord.updatedAt}
          weeklyRecord={snapshot.weeklyRecord}
        />
      </ExpandablePanel>

      <ExpandablePanel
        description="Recurring things Holdfast should bring into Now or Upcoming."
        isOpen={routineOpen}
        onToggle={() => setRoutineOpen((current) => !current)}
        summary={routineSummary}
        title="Routine setup"
      >
        <RoutineSetupPanel routines={snapshot.routines} />
      </ExpandablePanel>

      <ExpandablePanel
        description="Backup this workspace or recover earlier local work when you need to."
        isOpen={workspaceSafetyOpen}
        onToggle={() => setWorkspaceSafetyOpen((current) => !current)}
        summary="Back up this device or recover earlier prototype work."
        title="Workspace safety"
      >
        <Suspense fallback={<div className="empty-inline">Loading tools...</div>}>
          <div className="stack">
            <WorkspaceBackupPanel />
            <PrototypeRecoveryPanel />
          </div>
        </Suspense>
      </ExpandablePanel>
    </div>
  );
}
