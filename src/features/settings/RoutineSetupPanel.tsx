import { useState } from 'react';

import { LANES } from '@/domain/constants';
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

function isRoutineDirty(routine: RoutineRecord, draft: RoutineDraft): boolean {
  return (
    routine.title !== draft.title ||
    routine.lane !== draft.lane ||
    routine.destination !== draft.destination ||
    !sameWeekdays(routine.weekdays, draft.weekdays) ||
    (routine.scheduledTime ?? '') !== draft.scheduledTime ||
    routine.notes !== draft.notes ||
    routine.active !== draft.active
  );
}

function RoutineEditorCard({ routine }: { routine: RoutineRecord }) {
  const [draft, setDraft] = useState<RoutineDraft>(() =>
    buildRoutineDraft(routine),
  );
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );

  const dirty = isRoutineDirty(routine, draft);

  const handleSave = async (): Promise<void> => {
    if (!dirty) {
      return;
    }

    setSaveState('saving');
    await updateRoutine(routine.id, {
      active: draft.active,
      destination: draft.destination,
      lane: draft.lane,
      notes: draft.notes,
      scheduledTime: draft.scheduledTime || null,
      title: draft.title,
      weekdays: draft.weekdays,
    });
    setSaveState('saved');
  };

  const toggleWeekday = (value: number): void => {
    setSaveState('idle');
    setDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(value)
        ? current.weekdays.filter((entry) => entry !== value)
        : [...current.weekdays, value].sort((left, right) => left - right),
    }));
  };

  return (
    <article className="item-card day-result">
      <label className="field-stack">
        <span>Title</span>
        <input
          onChange={(event) => {
            setSaveState('idle');
            setDraft((current) => ({ ...current, title: event.target.value }));
          }}
          type="text"
          value={draft.title}
        />
      </label>
      <div className="grid two">
        <label className="field-stack">
          <span>Area</span>
          <select
            onChange={(event) => {
              setSaveState('idle');
              setDraft((current) => ({
                ...current,
                lane: event.target.value as (typeof LANES)[number]['key'],
              }));
            }}
            value={draft.lane}
          >
            {LANES.map((lane) => (
              <option key={lane.key} value={lane.key}>
                {lane.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span>Place</span>
          <select
            onChange={(event) => {
              setSaveState('idle');
              setDraft((current) => ({
                ...current,
                destination: event.target.value as 'today' | 'upcoming',
              }));
            }}
            value={draft.destination}
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
              setDraft((current) => ({
                ...current,
                scheduledTime: event.target.value,
              }));
            }}
            type="time"
            value={draft.scheduledTime}
          />
        </label>
        <label className="field-stack">
          <span>Status</span>
          <select
            onChange={(event) => {
              setSaveState('idle');
              setDraft((current) => ({
                ...current,
                active: event.target.value === 'active',
              }));
            }}
            value={draft.active ? 'active' : 'off'}
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
              className={`chip ${draft.weekdays.includes(index) ? 'active' : ''}`}
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
            setDraft((current) => ({ ...current, notes: event.target.value }));
          }}
          rows={3}
          value={draft.notes}
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
              setDraft(buildRoutineDraft(routine));
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
              key={`${routine.id}-${routine.updatedAt}`}
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
