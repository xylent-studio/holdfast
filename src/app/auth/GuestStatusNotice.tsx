import { useAuth } from '@/app/auth/useAuth';

interface GuestStatusNoticeProps {
  nextPath?: string;
}

export function GuestStatusNotice({ nextPath }: GuestStatusNoticeProps) {
  const auth = useAuth();

  if (!auth.configured || auth.session) {
    return null;
  }

  return (
    <div className="guest-status-notice">
      <p>Using Holdfast locally on this device. Sign in when you want this workspace attached for sync.</p>
      <button
        className="button ghost small"
        onClick={() => void auth.continueWithGoogle(nextPath)}
        type="button"
      >
        Sign in
      </button>
    </div>
  );
}
