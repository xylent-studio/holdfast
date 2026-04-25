import { useState } from 'react';

import type { RoutineRecord } from '@/domain/schemas/records';
import {
  createRoutine,
  deleteRoutine,
  updateRoutine,
} from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';

interface RoutineSetupPanelProps {
  routines: RoutineRecord[];
}

interface RoutineDraft {
  active: boolean;
  destination: RoutineRecord['destination'];
  lane: RoutineRecord['lane'];
  notes: string;
  scheduledTime: string;
  title: string;
  weekdays: number[];
}

interface RoutineDraftState {
  base: RoutineDraft;
  draft: RoutineDraft;
}

function buildRoutineDraft(routine: RoutineRecord): RoutineDraft {
  return {
    active: routine.active,
    destination: routine.destination,
    lane: routine.lane,
    notes: routine.notes,
    scheduledTime: routine.scheduledTime ?? '',
    title: routine.title,
    weekdays: routine.weekdays,
  };
}

function sameWeekdays(left: number[], right: number[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameRoutineDraft(left: RoutineDraft, right: RoutineDraft): boolean {
  return (
    left.title === right.title &&
    left.destination === right.destination &&
    sameWeekdays(left.weekdays, right.weekdays) &&
    left.scheduledTime === right.scheduledTime &&
    left.notes === right.notes &&
    left.active === right.active &&
    left.lane === right.lane
  );
}

function RoutineEditorCard({ routine }: { routine: RoutineRecord }) {
  const incomingDraft = buildRoutineDraft(routine);
  const [draftState, setDraftState] = useState<RoutineDraftState>(() => ({
    base: incomingDraft,
    draft: incomingDraft,
  }));
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );

  const wasDirty = !sameRoutineDraft(draftState.draft, draftState.base);
  const hasIncomingRefresh = !sameRoutineDraft(incomingDraft, draftState.base);

  if (hasIncomingRefresh) {
    setDraftState({
      base: incomingDraft,
      draft: wasDirty ? draftState.draft : incomingDraft,
    });
  }

  const activeBase = hasIncomingRefresh ? incomingDraft : draftState.base;
  const activeDraft =
    hasIncomingRefresh && !wasDirty ? incomingDraft : draftState.draft;
  const dirty = !sameRoutineDraft(activeDraft, activeBase);

  const handleSave = async (): Promise<void> => {
    if (!dirty) {
      return;
    }

    setSaveState('saving');
    await updateRoutine(routine.id, {
      active: activeDraft.active,
      destination: activeDraft.destination,
      lane: activeDraft.lane,
      notes: activeDraft.notes,
      scheduledTime: activeDraft.scheduledTime || null,
      title: activeDraft.title,
      weekdays: activeDraft.weekdays,
    });
    setDraftState({
      base: activeDraft,
      draft: activeDraft,
    });
    setSaveState('saved');
  };

  const toggleWeekday = (value: number): void => {
    setSaveState('idle');
    const sourceDraft = dirty ? draftState.draft : activeDraft;
    setDraftState((current) => ({
      ...current,
      draft: {
        ...(dirty ? current.draft : activeDraft),
        weekdays: sourceDraft.weekdays.includes(value)
          ? sourceDraft.weekdays.filter((entry) => entry !== value)
          : [...sourceDraft.weekdays, value].sort(
              (left, right) => left - right,
            ),
      },
    }));
  };

  return (
    <article className="item-card day-result">
      <label className="field-stack">
        <span>Title</span>
        <input
          onChange={(event) => {
            setSaveState('idle');
            setDraftState((current) => ({
              ...current,
              draft: {
                ...(dirty ? current.draft : activeDraft),
                title: event.target.value,
              },
            }));
          }}
          type="text"
          value={activeDraft.title}
        />
      </label>
      <div className="grid two">
        <label className="field-stack">
          <span>Place</span>
          <select
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  destination: event.target.value as 'today' | 'upcoming',
                },
              }));
            }}
            value={activeDraft.destination}
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
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  scheduledTime: event.target.value,
                },
              }));
            }}
            type="time"
            value={activeDraft.scheduledTime}
          />
        </label>
        <label className="field-stack">
          <span>Status</span>
          <select
            onChange={(event) => {
              setSaveState('idle');
              setDraftState((current) => ({
                ...current,
                draft: {
                  ...(dirty ? current.draft : activeDraft),
                  active: event.target.value === 'active',
                },
              }));
            }}
            value={activeDraft.active ? 'active' : 'off'}
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
              className={`chip ${activeDraft.weekdays.includes(index) ? 'active' : ''}`}
              key={`${routine.id}-${index}`}
              onClick={() => toggleWeekday(index)}
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
          rows={3}
          value={activeDraft.notes}
        />
      </label>
      <div className="dialog-actions spread">
        <button
          className="button danger"
          onClick={() => void deleteRoutine(routine.id)}
          type="button"
        >
          Delete
        </button>
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
      </div>
    </article>
  );
}

export function RoutineSetupPanel({ routines }: RoutineSetupPanelProps) {
  return (
    <div className="stack">
      <div className="dialog-actions">
        <button className="button accent" onClick={() => void createRoutine()} type="button">
          Add routine
        </button>
      </div>
      {routines.length ? (
        <div className="item-list">
          {routines.map((routine) => (
            <RoutineEditorCard
              key={routine.id}
              routine={routine}
            />
          ))}
        </div>
      ) : (
        <EmptyState>No custom routines yet.</EmptyState>
      )}
    </div>
  );
}
