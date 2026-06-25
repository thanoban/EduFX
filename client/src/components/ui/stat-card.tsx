import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon
}: {
  label: string;
  value: string;
  hint: string;
  icon?: ReactNode;
}) {
  return (
    <article className="stat-card">
      <div className="stat-card__top">
        <div className="muted">{label}</div>
        {icon ? <span className="icon-tile">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      <div className="muted small-text">{hint}</div>
    </article>
  );
}
