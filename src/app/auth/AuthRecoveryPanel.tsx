import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import { Panel } from '@/shared/ui/Panel';

interface AuthRecoveryPanelProps {
  nextPath?: string;
}

export function AuthRecoveryPanel({ nextPath }: AuthRecoveryPanelProps) {
  return (
    <Panel>
      <div className="panel-header">
        <h2>Sign in again</h2>
        <p>
          Local work is still here. Sign in again to keep this device in sync.
        </p>
      </div>
      <AuthAccessActions hasLocalData nextPath={nextPath} />
    </Panel>
  );
}
