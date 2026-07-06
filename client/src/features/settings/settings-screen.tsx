"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { settingsApi } from "@/lib/api";
import type { SessionLength } from "@/types/contracts";
import { CalendarClock, Clock3, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SESSION_LENGTH_OPTIONS: Array<{ value: SessionLength; label: string }> = [
  { value: "short", label: "15–20 min" },
  { value: "medium", label: "30–45 min" },
  { value: "long", label: "1hr+" }
];

// Build the per-day map from the profile, falling back to the old single
// session-length (applied to every free day) for students saved before per-day
// availability existed.
function initialDayLengths(student: ReturnType<typeof useAuthGuard>["student"]): Record<number, SessionLength> {
  const stored = student?.day_session_length ?? {};
  if (Object.keys(stored).length > 0) {
    const out: Record<number, SessionLength> = {};
    for (const [day, length] of Object.entries(stored)) {
      out[Number(day)] = length;
    }
    return out;
  }
  const fallback: Record<number, SessionLength> = {};
  for (const day of student?.free_days ?? []) {
    fallback[day] = student?.session_length ?? "medium";
  }
  return fallback;
}

export function SettingsScreen() {
  const { student, signOut, updateStudentProfile } = useAuthGuard();
  const [dayLengths, setDayLengths] = useState<Record<number, SessionLength>>(() => initialDayLengths(student));
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(student?.email_reminders_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    const freeDays = Object.keys(dayLengths).map(Number).sort((a, b) => a - b);
    // `session_length` stays as a fallback default for any day without a
    // per-day value; use the first selected day's choice, else medium.
    const defaultLength = freeDays.length > 0 ? dayLengths[freeDays[0]] : "medium";
    setSaving(true);
    setSaved(false);
    try {
      const profile = await settingsApi.updateAvailability(student.student_id, {
        free_days: freeDays,
        session_length: defaultLength,
        day_session_length: dayLengths,
        email_reminders_enabled: emailRemindersEnabled
      });
      updateStudentProfile(profile);
      setSaved(true);
    } finally {
      setSaving(false);
    }
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
              <div className="list">
                {DAY_LABELS.map((label, day) => {
                  const selected = dayLengths[day];
                  return (
                    <div key={label} className="list-item cluster" style={{ justifyContent: "space-between" }}>
                      <strong style={{ width: 44 }}>{label}</strong>
                      <div className="cluster">
                        <button
                          type="button"
                          className={`pill ${selected === undefined ? "success" : ""}`.trim()}
                          onClick={() => setDay(day, null)}
                        >
                          Off
                        </button>
                        {SESSION_LENGTH_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`pill ${selected === option.value ? "success" : ""}`.trim()}
                            onClick={() => setDay(day, option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="list-item cluster" style={{ justifyContent: "space-between", cursor: "pointer" }}>
              <span className="cluster">
                <Mail size={16} /> Email reminders if I miss a planned session
              </span>
              <input
                type="checkbox"
                checked={emailRemindersEnabled}
                onChange={(event) => {
                  setEmailRemindersEnabled(event.target.checked);
                  setSaved(false);
                }}
              />
            </label>

            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <Button onClick={handleSaveAvailability} disabled={saving}>
                {saving ? "Saving…" : "Save availability"}
              </Button>
              {saved ? <span className="muted small-text">Saved</span> : null}
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
