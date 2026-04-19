import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthAccessActions } from '@/app/auth/AuthAccessActions';
import {
  normalizeAuthNextPath,
  finishSupabaseAuthRedirect,
} from '@/storage/sync/supabase/auth';
import { getSupabaseBrowserClient } from '@/storage/sync/supabase/client';

export function AuthCallbackView() {
  const navigate = useNavigate();
  const nextPath = normalizeAuthNextPath(
    new URLSearchParams(window.location.search).get('next'),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Account setup isn't ready yet.");
      return;
    }

    let cancelled = false;

    void finishSupabaseAuthRedirect(client).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      navigate(nextPath, { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath]);

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
