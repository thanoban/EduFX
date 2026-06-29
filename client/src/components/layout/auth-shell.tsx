import type { PropsWithChildren, ReactNode } from "react";
import { Clock3, LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

export function AuthShell({
  hero,
  children
}: PropsWithChildren<{ hero: ReactNode }>) {
  const { student, signOut } = useAuth();

  return (
    <main className="hero-layout">
      <header className="auth-toolbar">
        <div className="auth-toolbar__brand">
          <strong>EduFX</strong>
          <span>Adaptive chemistry study planner</span>
        </div>

        {student ? (
          <div className="auth-toolbar__actions">
            <div className="auth-toolbar__timeout">
              <Clock3 size={15} />
              <span>Auto logout after 30 minutes of inactivity</span>
            </div>
            <div className="auth-toolbar__identity">
              <strong>{student.name}</strong>
              <span>{student.email}</span>
            </div>
            <Button href="/settings" variant="secondary" icon={<Settings size={16} />}>
              Settings
            </Button>
            <Button variant="ghost" icon={<LogOut size={16} />} onClick={signOut}>
              Log out
            </Button>
          </div>
        ) : (
          <div className="auth-toolbar__welcome">Secure access for your learning profile</div>
        )}
      </header>
      <section className="hero-panel">{hero}</section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
