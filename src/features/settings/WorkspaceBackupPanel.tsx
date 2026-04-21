import { useEffect, useState } from 'react';

import {
  createWorkspaceBackupExport,
  getWorkspaceRestoreUndoAvailability,
  importWorkspaceBackupFile,
  type WorkspaceBackupSummary,
  type WorkspaceRestoreResult,
  type WorkspaceRestoreUndoAvailability,
  undoLastWorkspaceRestore,
} from '@/storage/local/workspace-backup';
import { Panel } from '@/shared/ui/Panel';

function pluralize(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function summaryLine(summary: WorkspaceBackupSummary): string {
  const parts = [
    pluralize(summary.itemCount, 'item'),
    pluralize(summary.listCount, 'list'),
    pluralize(summary.listItemCount, 'list item'),
    pluralize(summary.routineCount, 'routine'),
    pluralize(summary.attachmentCount, 'attachment'),
  ];

  if (summary.attachmentPayloadMissingCount) {
    parts.push(
      `${pluralize(summary.attachmentPayloadMissingCount, 'attachment file')} still missing on this device`,
    );
  }

  return parts.join(' / ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Backup could not finish yet.';
}

function restoreResultLine(result: WorkspaceRestoreResult): string {
  const base = `Restored the backup from ${result.sourceExportedAt.slice(0, 10)} with ${summaryLine(result.summary)}.`;

  if (result.summary.attachmentPayloadMissingCount) {
    return `${base} Current items, lists, routines, settings, and attachment state were replaced on this device. Day and week history from the backup were restored by date, and missing attachment files stayed metadata-only until they can be rehydrated.`;
  }

  return `${base} Current items, lists, routines, settings, and attachment state were replaced on this device. Day and week history from the backup were restored by date.`;
}

function undoAvailabilityLine(
  availability: WorkspaceRestoreUndoAvailability,
): string | null {
  if (availability.mode !== 'recorded' || !availability.summary) {
    return null;
  }

  return `Last restore replaced this device workspace with ${summaryLine(availability.summary)}.`;
}

export function WorkspaceBackupPanel() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [undoAvailability, setUndoAvailability] =
    useState<WorkspaceRestoreUndoAvailability | null>(null);
  const [busyMode, setBusyMode] = useState<
    'export' | 'import' | 'undo' | null
  >(null);

  useEffect(() => {
    let active = true;

    void getWorkspaceRestoreUndoAvailability().then((availability) => {
      if (active) {
        setUndoAvailability(availability);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function refreshUndoAvailability(): Promise<void> {
    setUndoAvailability(await getWorkspaceRestoreUndoAvailability());
  }

  async function handleExport(): Promise<void> {
    setBusyMode('export');
    setFeedback(null);

    try {
      const { backup, blob, filename } = await createWorkspaceBackupExport();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setResult(`Downloaded a backup with ${summaryLine(backup.summary)}.`);
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleImport(file: File): Promise<void> {
    setBusyMode('import');
    setFeedback(null);

    try {
      const nextResult = await importWorkspaceBackupFile(file);
      setResult(restoreResultLine(nextResult));
      await refreshUndoAvailability();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleUndo(): Promise<void> {
    setBusyMode('undo');
    setFeedback(null);

    try {
      const nextResult = await undoLastWorkspaceRestore();
      setResult(`Undo restored the previous workspace from ${nextResult.sourceExportedAt.slice(0, 10)} with ${summaryLine(nextResult.summary)}.`);
      await refreshUndoAvailability();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <Panel>
      <div className="panel-header">
        <h2>Backup</h2>
        <p>
          Export a full backup of this device workspace, including attachments.
          You can also restore a Holdfast backup file here. Restoring replaces
          current items, lists, routines, settings, and attachment state on this
          device, while day and week history from the file are restored by date.
        </p>
      </div>
      <div className="dialog-actions">
        <button
          className="button ghost"
          disabled={busyMode !== null}
          onClick={() => void handleExport()}
          type="button"
        >
          {busyMode === 'export' ? 'Exporting...' : 'Export backup'}
        </button>
        <label className="button ghost file-button">
          <span>
            {busyMode === 'import' ? 'Restoring...' : 'Restore backup file'}
          </span>
          <input
            accept="application/json,.json"
            disabled={busyMode !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                void handleImport(file);
              }
            }}
            type="file"
          />
        </label>
      </div>
      {undoAvailability?.mode === 'recorded' ? (
        <div className="recovery-note">
          <strong>Last restore can be undone cleanly on this device.</strong>
          {undoAvailabilityLine(undoAvailability) ? (
            <p>{undoAvailabilityLine(undoAvailability)}</p>
          ) : null}
          <div className="dialog-actions">
            <button
              className="button ghost"
              disabled={busyMode !== null}
              onClick={() => void handleUndo()}
              type="button"
            >
              {busyMode === 'undo' ? 'Undoing...' : 'Undo last restore'}
            </button>
          </div>
        </div>
      ) : null}
      {result ? <p className="recovery-result">{result}</p> : null}
      {feedback ? <p className="auth-feedback danger">{feedback}</p> : null}
    </Panel>
  );
}
