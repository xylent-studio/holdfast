import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import { useAuth } from '@/app/auth/useAuth';
import { normalizeAuthNextPath } from '@/storage/sync/supabase/auth';

export function AuthCallbackView() {
  const auth = useAuth();
  const navigate = useNavigate();
  const nextPath = normalizeAuthNextPath(
    new URLSearchParams(window.location.search).get('next'),
  );

  useEffect(() => {
    if (!auth.configured || !auth.isReady || !auth.session) {
      return;
    }

    navigate(nextPath, { replace: true });
  }, [auth.configured, auth.isReady, auth.session, navigate, nextPath]);

  const error = !auth.configured
    ? "Account setup isn't ready yet."
    : auth.isReady && !auth.session
      ? auth.error ?? "Couldn't finish sign-in. Try again."
      : null;

  return (
    <div className="auth-shell">
      <section className="panel auth-card">
        {error ? (
          <>
            <div className="auth-copy">
              <div className="eyebrow">Holdfast</div>
              <h1>Sign-in didn&apos;t finish.</h1>
              <p>Nothing here was lost. Try again.</p>
            </div>
            <AuthAccessActions nextPath={nextPath} />
            <p className="auth-feedback danger">{error}</p>
          </>
        ) : (
          <div className="auth-copy">
            <div className="eyebrow">Holdfast</div>
            <h1>Signing you in</h1>
            <p>Just a moment.</p>
          </div>
        )}
      </section>
    </div>
  );
}
