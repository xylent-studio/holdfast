import { useState } from 'react';

import {
  createWorkspaceBackupExport,
  type WorkspaceBackupSummary,
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

export function WorkspaceBackupPanel() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
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
      setIsExporting(false);
    }
  }

  return (
    <Panel>
      <div className="panel-header">
        <h2>Backup</h2>
        <p>
          Export a full backup of this device workspace, including attachments.
          Holdfast still treats signed-in sync as the normal path.
        </p>
      </div>
      <div className="dialog-actions">
        <button
          className="button ghost"
          disabled={isExporting}
          onClick={() => void handleExport()}
          type="button"
        >
          {isExporting ? 'Exporting...' : 'Export backup'}
        </button>
      </div>
      {result ? <p className="recovery-result">{result}</p> : null}
      {feedback ? <p className="auth-feedback danger">{feedback}</p> : null}
    </Panel>
  );
}
