import { useState } from 'react';

import { useAuth } from '@/app/auth/useAuth';

interface AuthAccessActionsProps {
  hasLocalData?: boolean;
  nextPath?: string;
}

export function AuthAccessActions({
  hasLocalData = false,
  nextPath,
}: AuthAccessActionsProps) {
  const {
    clearFeedback,
    continueWithGoogle,
    error,
    magicLinkSentTo,
    sendMagicLink,
  } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');

  return (
    <div className="auth-stack">
      <div className="auth-actions">
        <button
          className="button accent"
          onClick={() => void continueWithGoogle(nextPath)}
          type="button"
        >
          Continue with Google
        </button>
        <button
          className="button ghost"
          onClick={() => {
            clearFeedback();
            setEmailOpen((current) => !current);
          }}
          type="button"
        >
          Email me a sign-in link
        </button>
      </div>

      {emailOpen ? (
        <div className="auth-email-box">
          <label className="field-stack">
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <div className="dialog-actions">
            <button
              className="button accent"
              onClick={() => void sendMagicLink(email, nextPath)}
              type="button"
            >
              Send link
            </button>
          </div>
        </div>
      ) : null}

      {hasLocalData ? (
        <p className="auth-trust-line">
          We&apos;ll keep what&apos;s already here and sync it to your account.
        </p>
      ) : (
        <p className="auth-trust-line">
          Your stuff stays with you across devices and still works offline.
        </p>
      )}

      {magicLinkSentTo ? (
        <p className="auth-feedback">Check {magicLinkSentTo} for your link.</p>
      ) : null}
      {error ? <p className="auth-feedback danger">{error}</p> : null}
    </div>
  );
}
