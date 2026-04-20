import { useEffect, useState } from 'react';

import {
  getLegacyPrototypeBrowserSummary,
  getLegacyPrototypeUndoAvailability,
  importLegacyPrototypeBackupFile,
  importLegacyPrototypeFromBrowserStorage,
  undoLastLegacyPrototypeRecovery,
  undoLegacyPrototypeRecoveryFromBackupFile,
  undoLegacyPrototypeRecoveryFromBrowserStorage,
  type LegacyPrototypeImportResult,
  type LegacyPrototypeSummary,
  type LegacyPrototypeUndoAvailability,
  type LegacyPrototypeUndoResult,
} from '@/storage/local/legacy-prototype';
import { Panel } from '@/shared/ui/Panel';

function pluralize(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function recoverySummaryLine(summary: LegacyPrototypeSummary): string {
  return [
    pluralize(summary.itemCount, 'item'),
    pluralize(summary.routineCount, 'routine'),
    pluralize(summary.attachmentCount, 'attachment'),
    `across ${pluralize(summary.dayCount, 'day')} and ${pluralize(summary.weekCount, 'week')}`,
  ].join(' / ');
}

function recoveryResultLine(result: LegacyPrototypeImportResult): string {
  const recoveredParts = [
    pluralize(result.itemsImported, 'item'),
    pluralize(result.routinesImported, 'routine'),
    pluralize(result.attachmentsImported, 'attachment'),
  ];
  const mergedParts: string[] = [];

  if (result.daysCreated || result.daysMerged) {
    mergedParts.push(
      `${pluralize(result.daysCreated, 'day')} added, ${pluralize(result.daysMerged, 'day')} merged`,
    );
  }

  if (result.weeksCreated || result.weeksMerged) {
    mergedParts.push(
      `${pluralize(result.weeksCreated, 'week')} added, ${pluralize(result.weeksMerged, 'week')} merged`,
    );
  }

  if (result.settingsUpdated) {
    mergedParts.push('settings filled in');
  }

  const suffix = mergedParts.length ? ` ${mergedParts.join(' / ')}.` : '.';

  return `Recovered ${recoveredParts.join(' / ')}.${suffix} Existing records were left in place.`;
}

function undoResultLine(result: LegacyPrototypeUndoResult): string {
  const restoredParts = [
    pluralize(result.itemsDeleted, 'item'),
    pluralize(result.routinesDeleted, 'routine'),
    pluralize(result.attachmentsDeleted, 'attachment'),
  ];
  const stateParts: string[] = [];

  if (result.daysRestored || result.weeksRestored) {
    stateParts.push(
      `${pluralize(result.daysRestored, 'day')} restored`,
      `${pluralize(result.weeksRestored, 'week')} restored`,
    );
  }

  if (result.settingsRestored) {
    stateParts.push('settings restored');
  }

  if (result.partial) {
    stateParts.push('older imports only roll back merged day, week, and settings state when it is still safe to do so');
  }

  return `Undo removed ${restoredParts.join(' / ')}.${stateParts.length ? ` ${stateParts.join(' / ')}.` : ''}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Recovery could not finish yet.';
}

function readBrowserRecoveryState(): {
  browserSummary: LegacyPrototypeSummary | null;
  feedback: string | null;
} {
  try {
    return {
      browserSummary: getLegacyPrototypeBrowserSummary(),
      feedback: null,
    };
  } catch (error) {
    return {
      browserSummary: null,
      feedback: errorMessage(error),
    };
  }
}

export function PrototypeRecoveryPanel() {
  const [browserState, setBrowserState] = useState(readBrowserRecoveryState);
  const [importResult, setImportResult] =
    useState<LegacyPrototypeImportResult | null>(null);
  const [undoAvailability, setUndoAvailability] =
    useState<LegacyPrototypeUndoAvailability | null>(null);
  const [undoResult, setUndoResult] =
    useState<LegacyPrototypeUndoResult | null>(null);
  const [busyMode, setBusyMode] = useState<
    'recover-browser' | 'recover-file' | 'undo-browser' | 'undo-file' | 'undo-recorded' | null
  >(null);
  const { browserSummary, feedback } = browserState;

  useEffect(() => {
    let active = true;

    void getLegacyPrototypeUndoAvailability().then((nextAvailability) => {
      if (active) {
        setUndoAvailability(nextAvailability);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function clearFeedback(): void {
    setBrowserState((current) => ({
      ...current,
      feedback: null,
    }));
  }

  async function refreshState(): Promise<void> {
    setBrowserState(readBrowserRecoveryState());
    setUndoAvailability(await getLegacyPrototypeUndoAvailability());
  }

  async function handleBrowserRecovery(): Promise<void> {
    setBusyMode('recover-browser');
    clearFeedback();

    try {
      const nextResult = await importLegacyPrototypeFromBrowserStorage();
      setImportResult(nextResult);
      setUndoResult(null);
      await refreshState();
    } catch (error) {
      setBrowserState((current) => ({
        ...current,
        feedback: errorMessage(error),
      }));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleFileRecovery(file: File): Promise<void> {
    setBusyMode('recover-file');
    clearFeedback();

    try {
      const nextResult = await importLegacyPrototypeBackupFile(file);
      setImportResult(nextResult);
      setUndoResult(null);
      await refreshState();
    } catch (error) {
      setBrowserState((current) => ({
        ...current,
        feedback: errorMessage(error),
      }));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleRecordedUndo(): Promise<void> {
    setBusyMode('undo-recorded');
    clearFeedback();

    try {
      const nextResult = await undoLastLegacyPrototypeRecovery();
      setUndoResult(nextResult);
      setImportResult(null);
      await refreshState();
    } catch (error) {
      setBrowserState((current) => ({
        ...current,
        feedback: errorMessage(error),
      }));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleBrowserUndo(): Promise<void> {
    setBusyMode('undo-browser');
    clearFeedback();

    try {
      const nextResult = await undoLegacyPrototypeRecoveryFromBrowserStorage();
      setUndoResult(nextResult);
      setImportResult(null);
      await refreshState();
    } catch (error) {
      setBrowserState((current) => ({
        ...current,
        feedback: errorMessage(error),
      }));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleFileUndo(file: File): Promise<void> {
    setBusyMode('undo-file');
    clearFeedback();

    try {
      const nextResult = await undoLegacyPrototypeRecoveryFromBackupFile(file);
      setUndoResult(nextResult);
      setImportResult(null);
      await refreshState();
    } catch (error) {
      setBrowserState((current) => ({
        ...current,
        feedback: errorMessage(error),
      }));
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <Panel>
      <div className="panel-header">
        <h2>Prototype recovery</h2>
        <p>
          Bring earlier prototype notes, tasks, routines, day history, and files
          into this workspace without replacing what is already here.
        </p>
      </div>

      {browserSummary ? (
        <div className="recovery-note">
          <strong>Found earlier prototype data on this browser and origin.</strong>
          <p>{recoverySummaryLine(browserSummary)}</p>
        </div>
      ) : (
        <div className="recovery-note">
          <strong>Nothing was found on this browser and origin.</strong>
          <p>
            If the prototype lived on another URL, export a backup there and
            import the JSON file here.
          </p>
        </div>
      )}

      <div className="dialog-actions">
        {browserSummary ? (
          <button
            className="button accent"
            disabled={busyMode !== null}
            onClick={() => void handleBrowserRecovery()}
            type="button"
          >
            {busyMode === 'recover-browser'
              ? 'Recovering...'
              : 'Recover from this browser'}
          </button>
        ) : null}
        <label className="button ghost file-button">
          <span>
            {busyMode === 'recover-file' ? 'Importing...' : 'Import backup file'}
          </span>
          <input
            accept="application/json,.json"
            disabled={busyMode !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                void handleFileRecovery(file);
              }
            }}
            type="file"
          />
        </label>
      </div>

      {undoAvailability?.mode === 'recorded' ? (
        <div className="recovery-note">
          <strong>Last recovery can be undone cleanly on this device.</strong>
          {undoAvailability.summary ? (
            <p>{recoverySummaryLine(undoAvailability.summary)}</p>
          ) : null}
          <div className="dialog-actions">
            <button
              className="button ghost"
              disabled={busyMode !== null}
              onClick={() => void handleRecordedUndo()}
              type="button"
            >
              {busyMode === 'undo-recorded'
                ? 'Undoing...'
                : 'Undo last recovery'}
            </button>
          </div>
        </div>
      ) : null}

      {undoAvailability?.mode === 'retroactive' ? (
        <div className="recovery-note">
          <strong>An earlier recovery predates undo support.</strong>
          <p>
            Use the same source again to reverse it safely. Recovered items,
            routines, and attachments will be removed. Day, week, and settings
            state are only rolled back when they still match the imported backup.
          </p>
          <div className="dialog-actions">
            {browserSummary ? (
              <button
                className="button ghost"
                disabled={busyMode !== null}
                onClick={() => void handleBrowserUndo()}
                type="button"
              >
                {busyMode === 'undo-browser'
                  ? 'Undoing...'
                  : 'Undo with this browser data'}
              </button>
            ) : null}
            <label className="button ghost file-button">
              <span>
                {busyMode === 'undo-file'
                  ? 'Undoing...'
                  : 'Undo with the same backup file'}
              </span>
              <input
                accept="application/json,.json"
                disabled={busyMode !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    void handleFileUndo(file);
                  }
                }}
                type="file"
              />
            </label>
          </div>
        </div>
      ) : null}

      {importResult ? (
        <p className="recovery-result">{recoveryResultLine(importResult)}</p>
      ) : null}
      {undoResult ? (
        <p className="recovery-result">{undoResultLine(undoResult)}</p>
      ) : null}
      {feedback ? <p className="auth-feedback danger">{feedback}</p> : null}
    </Panel>
  );
}
