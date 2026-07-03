import { AlertTriangle, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type PageStateProps = {
  title: string;
  message: string;
  tone?: "loading" | "error" | "empty";
  layout?: "centered" | "workspace" | "auth";
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PageState({
  title,
  message,
  tone = "loading",
  layout = "centered",
  eyebrow,
  actionLabel,
  onAction
}: PageStateProps) {
  const isLoading = tone === "loading";

  if (isLoading && layout === "auth") {
    return <AuthLoadingState title={title} message={message} eyebrow={eyebrow} />;
  }

  if (isLoading && layout === "workspace") {
    return <WorkspaceLoadingState title={title} message={message} eyebrow={eyebrow} />;
  }

  return (
    <main className="state-page">
      <section className={`state-card state-card--${tone}`}>
        <div className="state-brand">
          <div className="brand-mark">FX</div>
          <div className="state-brand__copy">
            <strong>EduFX</strong>
            <span>Adaptive chemistry workspace</span>
          </div>
        </div>
        <div className="state-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="state-icon" aria-hidden="true">
          {isLoading ? <LoaderCircle size={26} /> : <AlertTriangle size={26} />}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">
            {eyebrow ??
              (isLoading
                ? "Preparing your workspace"
                : tone === "error"
                  ? "Something needs attention"
                  : "Nothing to show yet")}
          </span>
          <h2>{title}</h2>
          <p className="muted">{message}</p>
        </div>
        {isLoading ? (
          <div className="state-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  );
}

function AuthLoadingState({
  title,
  message,
  eyebrow = "Secure sign-in"
}: {
  title: string;
  message: string;
  eyebrow?: string;
}) {
  return (
    <main className="login-page-v2 login-page-v2--loading">
      <section className="login-story-panel">
        <div className="login-brand">
          <div className="brand-mark login-brand__mark">FX</div>
          <strong>EduFX</strong>
        </div>

        <div className="login-story-copy">
          <span className="pill">Adaptive workspace</span>
          <h1>Preparing your academic workspace.</h1>
          <p>Loading secure sign-in, study context, and personalized learning tools.</p>
        </div>

        <div className="login-insight-visual">
          <div className="login-insight-overlay">
            <div className="login-insight-icon">
              <LoaderCircle size={24} />
            </div>
            <div>
              <strong>{title}</strong>
              <span>{message}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-stage">
        <div className="login-card login-card--loading">
          <div className="login-card__header">
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
          <div className="stack">
            <div className="skeleton-field" />
            <div className="skeleton-field" />
            <div className="skeleton-button" />
          </div>
          <div className="auth-divider">Please wait</div>
          <div className="state-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    </main>
  );
}

function WorkspaceLoadingState({
  title,
  message,
  eyebrow = "Preparing your workspace"
}: {
  title: string;
  message: string;
  eyebrow?: string;
}) {
  return (
    <main className="app-shell workspace-loading-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FX</div>
          <div className="brand-copy">
            <h1>EduFX</h1>
            <small>Adaptive chemistry workspace</small>
          </div>
        </div>
        <div className="sidebar-meta">
          <span className="sidebar-chip">Loading session</span>
          <span className="sidebar-chip sidebar-chip--muted">Adaptive route</span>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <div className="loading-nav">
          <div className="skeleton-nav" />
          <div className="skeleton-nav" />
          <div className="skeleton-nav" />
          <div className="skeleton-nav" />
        </div>
        <div className="sidebar-user stack">
          <div className="cluster">
            <div className="avatar">FX</div>
            <div className="stack" style={{ gap: 6, width: "100%" }}>
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line" />
            </div>
          </div>
          <div className="skeleton-button skeleton-button--compact" />
        </div>
      </aside>

      <section className="main-area">
        <header className="workspace-topbar">
          <div className="stack" style={{ gap: 8, width: "100%" }}>
            <span className="eyebrow">{eyebrow}</span>
            <div className="skeleton-line skeleton-line--medium" />
          </div>
          <div className="skeleton-button skeleton-button--compact" />
        </header>

        <div className="page-panel">
          <section className="hero-strip">
            <div className="hero-strip__copy">
              <span className="eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
              <p className="muted">{message}</p>
            </div>
            <div className="hero-strip__metrics">
              <div className="metric-box">
                <strong>...</strong>
                <span>syncing</span>
              </div>
              <div className="metric-box">
                <strong>...</strong>
                <span>loading</span>
              </div>
              <div className="metric-box">
                <strong>...</strong>
                <span>preparing</span>
              </div>
            </div>
          </section>

          <div className="grid-2 loading-grid">
            <div className="section-card loading-card">
              <div className="skeleton-line skeleton-line--medium" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
            <div className="section-card loading-card">
              <div className="skeleton-line skeleton-line--medium" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
