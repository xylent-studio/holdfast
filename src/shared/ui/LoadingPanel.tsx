interface LoadingPanelProps {
  layout?: 'app' | 'auth' | 'screen';
  message?: string;
  title?: string;
}

export function LoadingPanel({
  layout = 'app',
  message = 'Getting things ready.',
  title = 'Opening Holdfast',
}: LoadingPanelProps) {
  const content = (
    <>
      <div className="eyebrow">Holdfast</div>
      <h1>{title}</h1>
      <p>{message}</p>
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
