import { AlertTriangle, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type PageStateProps = {
  title: string;
  message: string;
  tone?: "loading" | "error" | "empty";
  actionLabel?: string;
  onAction?: () => void;
};

export function PageState({
  title,
  message,
  tone = "loading",
  actionLabel,
  onAction
}: PageStateProps) {
  const isLoading = tone === "loading";
  return (
    <main className="state-page">
      <section className={`state-card state-card--${tone}`}>
        <div className="state-icon" aria-hidden="true">
          {isLoading ? <LoaderCircle size={26} /> : <AlertTriangle size={26} />}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <h2>{title}</h2>
          <p className="muted">{message}</p>
        </div>
        {actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  );
}
