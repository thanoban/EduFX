export function StatusPill({
  label,
  tone = "default"
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return <span className={`pill ${tone}`.trim()}>{label}</span>;
}
