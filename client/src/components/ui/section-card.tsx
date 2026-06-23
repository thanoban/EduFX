import type { PropsWithChildren } from "react";

export function SectionCard({
  title,
  eyebrow,
  children
}: PropsWithChildren<{ title: string; eyebrow?: string }>) {
  return (
    <section className="section-card stack">
      {eyebrow ? <span className="pill">{eyebrow}</span> : null}
      <div>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}
