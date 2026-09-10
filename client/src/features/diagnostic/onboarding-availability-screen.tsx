"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import {
  AvailabilityDayList,
  buildAvailabilityPayload,
  initialDayLengths
} from "@/features/settings/availability-picker";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { settingsApi } from "@/lib/api";
import type { SessionLength } from "@/types/contracts";

/**
 * Onboarding-only availability step, shown once right after the diagnostic
 * results, before the very first dashboard visit — so the scheduling agent
 * has real free-time data from day one instead of defaulting to unconfigured
 * until the student happens to visit Settings.
 */
export function OnboardingAvailabilityScreen() {
  const router = useRouter();
  const { student, updateStudentProfile } = useAuthGuard();
  const [dayLengths, setDayLengths] = useState<Record<number, SessionLength>>(() => initialDayLengths(student));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) {
      return;
    }
    setDayLengths(initialDayLengths(student));
  }, [student]);

  function setDay(day: number, length: SessionLength | null) {
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

  async function handleContinue() {
    if (!student) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const profile = await settingsApi.updateAvailability(
        student.student_id,
        buildAvailabilityPayload(dayLengths)
      );
      updateStudentProfile(profile);
      router.push("/dashboard");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save your availability. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const freeDayCount = Object.keys(dayLengths).length;

  return (
    <AppShell
      title="When are you free to study?"
      subtitle="One last step — this sizes your daily plan so a busy day stays light and a free day doesn't dump the whole syllabus at once."
      action={
        <Button icon={<ArrowRight size={16} />} onClick={handleContinue} disabled={saving}>
          {saving ? "Saving…" : "Start studying"}
        </Button>
      }
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow">
            <CalendarClock size={14} /> Final step
          </span>
          <h3>Mark how much time you have on each day.</h3>
          <p className="muted">
            You can change this any time later in Settings — this is just enough to build your
            first study plan.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{freeDayCount}</strong>
            <span>days marked free</span>
          </div>
        </div>
      </section>

      {saveError ? <div className="auth-error" role="alert">{saveError}</div> : null}

      <SectionCard title="How much time do you have each day?" eyebrow="Tap to select">
        <div className="stack">
          <AvailabilityDayList dayLengths={dayLengths} onSetDay={setDay} />
        </div>
      </SectionCard>
    </AppShell>
  );
}
