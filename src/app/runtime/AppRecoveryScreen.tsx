import { useEffect, useMemo, useState } from 'react';

import {
  exportRawWorkspaceSnapshot,
  removeDataFromDevice,
} from '@/storage/local/api';
import { LoadingPanel } from '@/shared/ui/LoadingPanel';

import {
  isRecoverableRuntimeError,
  repairRuntimeOnce,
} from './runtime-recovery';

interface AppRecoveryScreenProps {
  error: Error;
  mode: 'runtime' | 'storage';
  onRetry?: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Holdfast could not finish opening.';
}

export function AppRecoveryScreen({
  error,
  mode,
  onRetry,
}: AppRecoveryScreenProps) {
  const recoveryKey = `${mode}:${errorMessage(error)}`;
  const [busyMode, setBusyMode] = useState<
    'export' | 'resetting' | null
  >(null);
  const [dismissedAutoRepairKey, setDismissedAutoRepairKey] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const shouldAutoRepair = useMemo(
    () =>
      mode === 'runtime' &&
      isRecoverableRuntimeError(error) &&
      dismissedAutoRepairKey !== recoveryKey,
    [dismissedAutoRepairKey, error, mode, recoveryKey],
  );

  useEffect(() => {
    if (!shouldAutoRepair) {
      return;
    }

    void repairRuntimeOnce('runtime-boundary').then((result) => {
      if (result !== 'started') {
        setDismissedAutoRepairKey(recoveryKey);
      }
    });
  }, [recoveryKey, shouldAutoRepair]);

  async function handleExport(): Promise<void> {
    setBusyMode('export');
    setFeedback(null);

    try {
      const { blob, filename } = await exportRawWorkspaceSnapshot();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setFeedback('Downloaded a local recovery copy from this device.');
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleReset(): Promise<void> {
    const confirmed = window.confirm(
      'Reset this device?\n\nThis removes local Holdfast data from this browser so Holdfast can start cleanly again here.',
    );
    if (!confirmed) {
      return;
    }

    setBusyMode('resetting');
    setFeedback(null);

    try {
      await removeDataFromDevice();
      window.location.reload();
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
      setBusyMode(null);
    }
  }

  if (shouldAutoRepair) {
    return (
      <LoadingPanel
        layout="screen"
        message="Repairing the app runtime and reloading once."
        title="Repairing Holdfast"
      />
    );
  }

  return (
    <div className="loading-screen">
      <section className="panel loading-screen-card">
        <div className="auth-copy">
          <div className="eyebrow">Holdfast</div>
          <h1>Holdfast needs attention</h1>
          <p>
            {mode === 'runtime'
              ? 'The app hit a runtime problem and could not recover cleanly on its own.'
              : 'Local device data needs a deliberate recovery step before Holdfast can open normally again.'}
          </p>
        </div>
        <div className="stack compact">
          <p className="auth-feedback danger">{errorMessage(error)}</p>
          <div className="dialog-actions">
            {onRetry ? (
              <button
                className="button ghost"
                onClick={onRetry}
                type="button"
              >
                Try again
              </button>
            ) : null}
            <button
              className="button ghost"
              onClick={() => void handleExport()}
              type="button"
            >
              {busyMode === 'export' ? 'Exporting...' : 'Export local copy'}
            </button>
            <button
              className="button ghost"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload
            </button>
            <button
              className="button danger"
              onClick={() => void handleReset()}
              type="button"
            >
              {busyMode === 'resetting' ? 'Resetting...' : 'Reset this device'}
            </button>
          </div>
          {feedback ? <p className="form-status">{feedback}</p> : null}
        </div>
      </section>
    </div>
  );
}
