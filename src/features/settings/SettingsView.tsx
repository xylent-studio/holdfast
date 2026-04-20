import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import { useAuth } from '@/app/auth/AuthProvider';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { useSync } from '@/app/sync/SyncProvider';
import { LANES } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import { currentWeekLabel } from '@/domain/logic/selectors';
import { PrototypeRecoveryPanel } from '@/features/settings/PrototypeRecoveryPanel';
import { WorkspaceBackupPanel } from '@/features/settings/WorkspaceBackupPanel';
import {
  createRoutine,
  deleteRoutine,
  updateRoutine,
  updateSettings,
  updateWeeklyRecord,
} from '@/storage/local/api';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Panel } from '@/shared/ui/Panel';

interface SettingsViewProps {
  currentDate: DateKey;
  snapshot: HoldfastSnapshot;
}

function syncStatusLabel(
  configured: boolean,
  signedIn: boolean,
  isOnline: boolean,
  pendingMutationCount: number,
  syncMode: HoldfastSnapshot['syncState']['mode'],
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

  return identityState === 'member'
    ? 'Signed out on this device'
    : 'Not signed in';
}

export function SettingsView({ currentDate, snapshot }: SettingsViewProps) {
  const auth = useAuth();
  const sync = useSync();
  const localDataExists = hasMeaningfulLocalState(snapshot);

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header">
          <h1>Account</h1>
          <p>
            {auth.session
              ? 'Stay signed in quietly and let Holdfast catch up in the background.'
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
              hasLocalData={localDataExists}
              nextPath="/settings"
            />
          )}
        </div>
      </Panel>

      <WorkspaceBackupPanel />
      <PrototypeRecoveryPanel />

      <Panel>
        <div className="panel-header">
          <h2>Settings</h2>
          <p>Keep this light. Set only what helps.</p>
        </div>
        <div className="grid two">
          <label className="field-stack">
            <span>12-month direction</span>
            <textarea
              defaultValue={snapshot.settings.direction}
              key={`direction-${snapshot.settings.updatedAt}`}
              onBlur={(event) =>
                void updateSettings({ direction: event.target.value })
              }
              rows={4}
            />
          </label>
          <label className="field-stack">
            <span>Non-negotiables</span>
            <textarea
              defaultValue={snapshot.settings.standards}
              key={`standards-${snapshot.settings.updatedAt}`}
              onBlur={(event) =>
                void updateSettings({ standards: event.target.value })
              }
              rows={4}
            />
          </label>
        </div>
        <label className="field-stack">
          <span>Why this matters</span>
          <textarea
            defaultValue={snapshot.settings.why}
            key={`why-${snapshot.settings.updatedAt}`}
            onBlur={(event) => void updateSettings({ why: event.target.value })}
            rows={4}
          />
        </label>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Weekly</h2>
          <p>{currentWeekLabel(currentDate)}</p>
        </div>
        <div className="grid two">
          <label className="field-stack">
            <span>Week focus</span>
            <textarea
              defaultValue={snapshot.weeklyRecord.focus}
              key={`week-focus-${snapshot.weeklyRecord.updatedAt}`}
              onBlur={(event) =>
                void updateWeeklyRecord(currentDate, {
                  focus: event.target.value,
                })
              }
              rows={4}
            />
          </label>
          <label className="field-stack">
            <span>Protect</span>
            <textarea
              defaultValue={snapshot.weeklyRecord.protect}
              key={`week-protect-${snapshot.weeklyRecord.updatedAt}`}
              onBlur={(event) =>
                void updateWeeklyRecord(currentDate, {
                  protect: event.target.value,
                })
              }
              rows={4}
            />
          </label>
        </div>
        <label className="field-stack">
          <span>Notes</span>
          <textarea
            defaultValue={snapshot.weeklyRecord.notes}
            key={`week-notes-${snapshot.weeklyRecord.updatedAt}`}
            onBlur={(event) =>
              void updateWeeklyRecord(currentDate, {
                notes: event.target.value,
              })
            }
            rows={4}
          />
        </label>
      </Panel>

      <Panel>
        <div className="panel-header split">
          <div>
            <h2>Custom routines</h2>
            <p>Recurring things Holdfast should bring into Now or Upcoming.</p>
          </div>
          <button
            className="button accent"
            onClick={() => void createRoutine()}
            type="button"
          >
            Add routine
          </button>
        </div>
        {snapshot.routines.length ? (
          <div className="item-list">
            {snapshot.routines.map((routine) => (
              <article className="item-card day-result" key={routine.id}>
                <label className="field-stack">
                  <span>Title</span>
                  <input
                    onBlur={(event) =>
                      void updateRoutine(routine.id, {
                        title: event.target.value,
                      })
                    }
                    defaultValue={routine.title}
                    type="text"
                  />
                </label>
                <div className="grid two">
                  <label className="field-stack">
                    <span>Area</span>
                    <select
                      onChange={(event) =>
                        void updateRoutine(routine.id, {
                          lane: event.target
                            .value as (typeof LANES)[number]['key'],
                        })
                      }
                      value={routine.lane}
                    >
                      {LANES.map((lane) => (
                        <option key={lane.key} value={lane.key}>
                          {lane.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-stack">
                    <span>Destination</span>
                    <select
                      onChange={(event) =>
                        void updateRoutine(routine.id, {
                          destination: event.target.value as
                            | 'today'
                            | 'upcoming',
                        })
                      }
                      value={routine.destination}
                    >
                      <option value="today">Now</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </label>
                </div>
                <div className="grid two">
                  <label className="field-stack">
                    <span>Time</span>
                    <input
                      onBlur={(event) =>
                        void updateRoutine(routine.id, {
                          scheduledTime: event.target.value || null,
                        })
                      }
                      defaultValue={routine.scheduledTime ?? ''}
                      type="time"
                    />
                  </label>
                  <label className="field-stack">
                    <span>Status</span>
                    <select
                      onChange={(event) =>
                        void updateRoutine(routine.id, {
                          active: event.target.value === 'active',
                        })
                      }
                      value={routine.active ? 'active' : 'off'}
                    >
                      <option value="active">Active</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                </div>
                <div className="field-stack">
                  <span>Days</span>
                  <div className="chip-row">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                      <button
                        className={`chip ${routine.weekdays.includes(index) ? 'active' : ''}`}
                        key={`${routine.id}-${index}`}
                        onClick={() =>
                          void updateRoutine(routine.id, {
                            weekdays: routine.weekdays.includes(index)
                              ? routine.weekdays.filter(
                                  (entry) => entry !== index,
                                )
                              : [...routine.weekdays, index].sort(
                                  (left, right) => left - right,
                                ),
                          })
                        }
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="field-stack">
                  <span>Notes</span>
                  <textarea
                    onBlur={(event) =>
                      void updateRoutine(routine.id, {
                        notes: event.target.value,
                      })
                    }
                    defaultValue={routine.notes}
                    rows={3}
                  />
                </label>
                <div className="dialog-actions">
                  <button
                    className="button danger"
                    onClick={() => void deleteRoutine(routine.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No custom routines yet.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
