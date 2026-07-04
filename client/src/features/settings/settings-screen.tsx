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

export function SettingsScreen() {
  const { student, signOut, updateStudentProfile } = useAuthGuard();
  const [freeDays, setFreeDays] = useState<number[]>(student?.free_days ?? []);
  const [sessionLength, setSessionLength] = useState<SessionLength>(student?.session_length ?? "medium");
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(student?.email_reminders_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleDay(day: number) {
    setSaved(false);
    setFreeDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    );
  }

  async function handleSaveAvailability() {
    if (!student) {
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const profile = await settingsApi.updateAvailability(student.student_id, {
        free_days: freeDays,
        session_length: sessionLength,
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
              Tell EduFX which days you're usually free and how much time you have — your daily plan
              is sized to fit, even on a fully-free day, so other subtopics aren't left behind.
            </p>

            <div className="stack" style={{ gap: 8 }}>
              <span className="field__label">Which days are you usually free to study?</span>
              <div className="cluster">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    className={`pill ${freeDays.includes(day) ? "success" : ""}`.trim()}
                    onClick={() => toggleDay(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <span className="field__label">On a free day, how much time do you have?</span>
              <div className="cluster">
                {SESSION_LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`pill ${sessionLength === option.value ? "success" : ""}`.trim()}
                    onClick={() => {
                      setSessionLength(option.value);
                      setSaved(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
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
