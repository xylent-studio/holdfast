import { useState } from 'react';

import {
  getLegacyPrototypeBrowserSummary,
  importLegacyPrototypeBackupFile,
  importLegacyPrototypeFromBrowserStorage,
  type LegacyPrototypeImportResult,
  type LegacyPrototypeSummary,
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
  const [result, setResult] = useState<LegacyPrototypeImportResult | null>(null);
  const [busyMode, setBusyMode] = useState<'browser' | 'file' | null>(null);
  const { browserSummary, feedback } = browserState;

  async function handleBrowserRecovery(): Promise<void> {
    setBusyMode('browser');
    setBrowserState((current) => ({
      ...current,
      feedback: null,
    }));

    try {
      const nextResult = await importLegacyPrototypeFromBrowserStorage();
      setResult(nextResult);
      setBrowserState(readBrowserRecoveryState());
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
    setBusyMode('file');
    setBrowserState((current) => ({
      ...current,
      feedback: null,
    }));

    try {
      const nextResult = await importLegacyPrototypeBackupFile(file);
      setResult(nextResult);
      setBrowserState(readBrowserRecoveryState());
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
            {busyMode === 'browser'
              ? 'Recovering...'
              : 'Recover from this browser'}
          </button>
        ) : null}
        <label className="button ghost file-button">
          <span>{busyMode === 'file' ? 'Importing...' : 'Import backup file'}</span>
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

      {result ? (
        <p className="recovery-result">{recoveryResultLine(result)}</p>
      ) : null}
      {feedback ? <p className="auth-feedback danger">{feedback}</p> : null}
    </Panel>
  );
}
