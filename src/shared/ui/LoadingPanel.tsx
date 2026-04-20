interface LoadingPanelProps {
  layout?: 'app' | 'auth' | 'screen';
}

export function LoadingPanel({ layout = 'app' }: LoadingPanelProps) {
  const content = (
    <>
      <div className="eyebrow">Holdfast</div>
      <h1>Opening Holdfast</h1>
      <p>Getting things ready.</p>
    </>
  );

  if (layout === 'auth') {
    return (
      <div className="auth-shell">
        <section className="panel auth-card">
          <div className="auth-copy">{content}</div>
        </section>
      </div>
    );
  }

  if (layout === 'screen') {
    return (
      <div className="loading-screen">
        <section className="panel loading-screen-card">
          <div className="auth-copy">{content}</div>
        </section>
      </div>
    );
  }

  return <section className="panel loading-panel">{content}</section>;
}
