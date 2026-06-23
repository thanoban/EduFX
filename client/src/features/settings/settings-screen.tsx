"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { useAuthGuard } from "@/features/auth/use-auth-guard";

export function SettingsScreen() {
  const { student, signOut } = useAuthGuard();

  return (
    <AppShell
      title="Settings"
      subtitle="Local demo preferences and account session controls."
    >
      <div className="grid-2">
        <SectionCard title="Profile" eyebrow="Current student">
          <div className="stack">
            <div className="list-item">
              <strong>{student?.name}</strong>
              <div className="muted">{student?.email}</div>
            </div>
            <div className="list-item">Google auth can be enabled by adding Supabase frontend credentials.</div>
          </div>
        </SectionCard>
        <SectionCard title="Session controls" eyebrow="Demo runtime">
          <div className="stack">
            <div className="list-item">The rebuilt app stores auth, diagnostic, and last-session state locally for quick demos.</div>
            <Button variant="secondary" onClick={signOut}>
              Clear session and sign out
            </Button>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
