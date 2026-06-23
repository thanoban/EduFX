export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="stat-card">
      <div className="muted">{label}</div>
      <strong>{value}</strong>
      <div className="muted">{hint}</div>
    </article>
  );
}
