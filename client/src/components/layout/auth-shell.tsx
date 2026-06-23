import type { PropsWithChildren, ReactNode } from "react";

export function AuthShell({
  hero,
  children
}: PropsWithChildren<{ hero: ReactNode }>) {
  return (
    <main className="hero-layout">
      <section className="hero-panel">{hero}</section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
