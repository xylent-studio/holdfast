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
          <h1>Keep the real-life things you need close.</h1>
          <p>
            Catch notes, lists, receipts, screenshots, and loose thoughts, then
            find them again without turning your day into a system.
          </p>
        </div>
        <AuthAccessActions nextPath={nextPath} />
      </section>
    </div>
  );
}
