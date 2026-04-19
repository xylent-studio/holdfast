import { AuthAccessActions } from '@/app/auth/AuthAccessActions';

interface AuthLandingViewProps {
  nextPath?: string;
}

export function AuthLandingView({ nextPath }: AuthLandingViewProps) {
  return (
    <div className="auth-shell">
      <section className="panel auth-card">
        <div className="auth-copy">
          <div className="eyebrow">Holdfast</div>
          <h1>Stay in command of real life.</h1>
          <p>
            Keep what matters, pick it back up anywhere, and keep moving without
            ceremony.
          </p>
        </div>
        <AuthAccessActions nextPath={nextPath} />
      </section>
    </div>
  );
}
