import type { PropsWithChildren, ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  action,
  children
}: PropsWithChildren<{ title: string; eyebrow?: string; action?: ReactNode }>) {
  return (
    <section className="section-card stack">
      <div className="section-card__header">
        <div className="stack" style={{ gap: 6 }}>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
