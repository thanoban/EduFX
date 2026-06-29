"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";

export function SettingsScreen() {
  const { student, signOut } = useAuthGuard();

  return (
    <AppShell
      title="Settings"
      subtitle="Account profile and session controls."
    >
      <div className="grid-2">
        <SectionCard title="Profile" eyebrow="Current student" action={<UserRound size={18} />}>
          <div className="stack">
            <div className="list-item">
              <strong>{student?.name}</strong>
              <div className="muted">{student?.email}</div>
            </div>
            <div className="list-item">Google sign-in is handled through the configured Supabase project.</div>
          </div>
        </SectionCard>
        <SectionCard title="Session controls" eyebrow="Security" action={<ShieldCheck size={18} />}>
          <div className="stack">
            <div className="list-item">
              Logging out clears this browser session and returns you to the EduFX sign-in screen.
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
