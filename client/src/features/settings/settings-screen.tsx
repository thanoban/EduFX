"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { settingsApi } from "@/lib/api";
import type { SessionLength } from "@/types/contracts";
import { CalendarClock, Clock3, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { AvailabilityDayList, buildAvailabilityPayload, initialDayLengths } from "@/features/settings/availability-picker";

export function SettingsScreen() {
  const { student, loading, signOut, updateStudentProfile } = useAuthGuard();
  const [dayLengths, setDayLengths] = useState<Record<number, SessionLength>>(() => initialDayLengths(student));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) {
      return;
    }
    setDayLengths(initialDayLengths(student));
  }, [student]);

  function setDay(day: number, length: SessionLength | null) {
    setSaved(false);
    setDayLengths((current) => {
      const next = { ...current };
      if (length === null) {
        delete next[day];
      } else {
        next[day] = length;
      }
      return next;
    });
  }

  async function handleSaveAvailability() {
    if (!student) {
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const profile = await settingsApi.updateAvailability(
        student.student_id,
        buildAvailabilityPayload(dayLengths)
      );
      updateStudentProfile(profile);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save availability. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !student) {
    return (
      <PageState
        layout="workspace"
        title="Loading settings"
        message="EduFX is restoring your account and study availability."
        eyebrow="Settings"
      />
    );
  }

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

      <div style={{ marginTop: 24 }}>
        <SectionCard
          title="Study availability"
          eyebrow="Personalized daily plan"
          action={<CalendarClock size={18} />}
        >
          <div className="stack">
            <p className="muted">
              Tell EduFX how much time you have on each day — your plan for a given day is sized to
              fit that day, so a busy Tuesday stays light and a free Saturday still doesn't dump the
              whole syllabus in one sitting.
            </p>

            <div className="stack" style={{ gap: 8 }}>
              <span className="field__label">How much time do you have each day?</span>
              <AvailabilityDayList dayLengths={dayLengths} onSetDay={setDay} />
            </div>

            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <Button onClick={handleSaveAvailability} disabled={saving}>
                {saving ? "Saving…" : "Save availability"}
              </Button>
              {saved ? <span className="muted small-text">Saved</span> : null}
            </div>
            {saveError ? <div className="auth-error" role="alert">{saveError}</div> : null}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
