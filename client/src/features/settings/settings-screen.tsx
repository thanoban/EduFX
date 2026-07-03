"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { Clock3, LogOut, ShieldCheck, UserRound } from "lucide-react";

export function SettingsScreen() {
  const { student, signOut } = useAuthGuard();

  return (
    <AppShell
      title="Settings"
      subtitle="Account profile and session controls."
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow"><ShieldCheck size={14} /> Workspace controls</span>
          <h3>Manage the signed-in study session and account context.</h3>
          <p className="muted">
            EduFX keeps the account experience simple: one active study profile, secure sign-out,
            and an automatic timeout after inactivity.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>30 min</strong>
            <span>idle logout timer</span>
          </div>
          <div className="metric-box">
            <strong>Supabase</strong>
            <span>authentication provider</span>
          </div>
          <div className="metric-box">
            <strong>1 profile</strong>
            <span>active student context</span>
          </div>
        </div>
      </section>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard icon={<UserRound size={18} />} label="Signed in as" value={student?.name ?? "Student"} hint={student?.email ?? "No email"} />
        <StatCard icon={<Clock3 size={18} />} label="Session timeout" value="30 min" hint="Resets with activity" />
        <StatCard icon={<ShieldCheck size={18} />} label="Auth provider" value="Supabase" hint="Google and email/password flows" />
      </div>

      <div className="grid-2">
        <SectionCard title="Profile" eyebrow="Current student" action={<UserRound size={18} />}>
          <div className="stack">
            <div className="list-item">
              <strong>{student?.name}</strong>
              <div className="muted">{student?.email}</div>
            </div>
            <div className="list-item">
              Google sign-in and email/password access both route through the configured Supabase project.
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Session controls" eyebrow="Security" action={<ShieldCheck size={18} />}>
          <div className="stack">
            <div className="list-item">
              Logging out clears this browser session and returns you to the EduFX sign-in screen.
            </div>
            <div className="list-item">
              EduFX also signs you out automatically after 30 minutes of inactivity for shared-device safety.
            </div>
            <Button icon={<LogOut size={16} />} variant="secondary" onClick={signOut}>
              Log out
            </Button>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
