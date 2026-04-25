import type { WorkspaceStateRecord } from '@/domain/schemas/records';
import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import { Panel } from '@/shared/ui/Panel';

interface AuthRecoveryPanelProps {
  nextPath?: string;
  reason: WorkspaceStateRecord['authPromptState'];
}

function recoveryCopy(reason: WorkspaceStateRecord['authPromptState']): {
  body: string;
  trustMessage?: string;
  title: string;
} {
  if (reason === 'account-mismatch') {
    return {
      title: 'Use the original account',
      body: 'Local work is still here. Sign back into the original account to keep this device in sync.',
      trustMessage:
        'This device will not attach to a different account until the ownership issue is resolved.',
    };
  }

  if (reason === 'signed-out-by-user') {
    return {
      title: 'Sign in when you want sync back',
      body: 'Local work is still here. Sign back in on this device when you want it attached and syncing again.',
    };
  }

  return {
    title: 'Sign in again',
    body: 'Local work is still here. Sign in again to keep this device in sync.',
  };
}

export function AuthRecoveryPanel({
  nextPath,
  reason,
}: AuthRecoveryPanelProps) {
  const copy = recoveryCopy(reason);

  return (
    <Panel>
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </div>
      <AuthAccessActions
        hasLocalData
        nextPath={nextPath}
        trustMessage={copy.trustMessage}
      />
    </Panel>
  );
}
