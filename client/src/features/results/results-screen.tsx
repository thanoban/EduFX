"use client";

import { useState } from "react";
import { ArrowLeft, Award, Brain, CalendarClock, Gauge, ListChecks, Smartphone, Target } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { settingsApi } from "@/lib/api";
import type { CoachPlan, NextFreeChoice, QuizResultPayload, SessionResults } from "@/types/contracts";

const NEXT_FREE_OPTIONS: Array<{ value: NextFreeChoice; label: string }> = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "in_2_days", label: "In 2 days" },
  { value: "this_weekend", label: "This weekend" },
  { value: "not_sure", label: "Not sure" }
];

export function ResultsScreen({
  results,
  explanations,
  coachPlan,
  lastQuizResult
}: {
  results: SessionResults;
  explanations: Array<{ attempt_id: number; explanation: string }>;
  coachPlan: CoachPlan | null;
  lastQuizResult: QuizResultPayload | null;
}) {
  const { student, updateStudentProfile } = useAuthGuard();
  const [nextFreeChoice, setNextFreeChoice] = useState<NextFreeChoice | null>(null);
  const explanationMap = new Map(explanations.map((item) => [item.attempt_id, item.explanation]));

  async function handleNextFree(choice: NextFreeChoice) {
    if (!student) {
      return;
    }
    setNextFreeChoice(choice);
    const profile = await settingsApi.checkInNextFree(student.student_id, choice);
    updateStudentProfile(profile);
  }
  const levelShiftLabel = lastQuizResult?.level_changed
    ? `${lastQuizResult.previous_level} -> ${lastQuizResult.new_level}`
    : `Stayed at ${lastQuizResult?.new_level ?? "current level"}`;
  const focusTracked = results.focus_score !== null && results.focus_score !== undefined;
  const focusLabel = focusTracked ? `${results.focus_score}%` : "Not tracked";

  return (
    <AppShell
      title="Session complete"
      subtitle="Review score, focus outcome, and AI explanations for any mistakes."
      action={
        <Button href="/dashboard" icon={<ArrowLeft size={17} />}>
          Back to dashboard
        </Button>
      }
    >
      <section className="hero-strip hero-strip--success">
        <div className="hero-strip__copy">
          <span className="pill success"><Award size={15} /> Session review</span>
          <h3>{results.quiz_score >= 70 ? "Strong session" : "Recovery session"}</h3>
          <p className="muted">
            EduFX combined quiz performance, focus behaviour, and wrong-answer review into one feedback
            loop so the next plan can adapt with context.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{results.quiz_score}%</strong>
            <span>quiz score</span>
          </div>
          <div className="metric-box">
            <strong>{focusLabel}</strong>
            <span>focus score</span>
          </div>
          <div className="metric-box">
            <strong>{levelShiftLabel}</strong>
            <span>level outcome</span>
          </div>
        </div>
      </section>

      <div className="grid-4">
        <StatCard icon={<Award size={18} />} label="Quiz score" value={`${results.quiz_score}%`} hint={`${results.correct_answers}/${results.total_questions} correct`} />
        <StatCard icon={<Gauge size={18} />} label="Focus score" value={focusLabel} hint={results.webcam_enabled ? "Webcam summary enabled" : "Tracking skipped"} />
        <StatCard icon={<Smartphone size={18} />} label="Phone alerts" value={`${results.phone_percent}%`} hint="Snapshot share" />
        <StatCard icon={<Target size={18} />} label="Away alerts" value={`${results.away_percent}%`} hint="Attention drift" />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionCard title="Nice work! When are you next free?" eyebrow="Study check-in" action={<CalendarClock size={18} />}>
          <div className="stack">
            <p className="muted">
              EduFX uses this to plan ahead and give you a gentle nudge if a planned day slips by.
            </p>
            <div className="cluster">
              {NEXT_FREE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pill ${nextFreeChoice === option.value ? "success" : ""}`.trim()}
                  onClick={() => handleNextFree(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {nextFreeChoice ? <span className="muted small-text">Got it — thanks!</span> : null}
          </div>
        </SectionCard>
      </div>

      {coachPlan ? (
        <div className="grid-2" style={{ marginTop: 24 }}>
          <SectionCard title="Learning coach" eyebrow="Multi-agent session plan">
            <div className="stack">
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <div className="cluster">
                  <Brain size={18} />
                  <strong>{coachPlan.headline}</strong>
                </div>
                <StatusPill label={`${coachPlan.confidence} confidence`} tone={coachPlan.confidence === "low" ? "warning" : "success"} />
              </div>
              <div className="list">
                {coachPlan.insights.map((insight) => (
                  <div key={insight.agent} className="list-item stack">
                    <div className="cluster" style={{ justifyContent: "space-between" }}>
                      <strong>{insight.title}</strong>
                      <StatusPill label={insight.severity} tone={insight.severity === "danger" ? "danger" : insight.severity === "warning" ? "warning" : "success"} />
                    </div>
                    <div className="muted">{insight.summary}</div>
                    {insight.evidence.length ? (
                      <div className="muted">{insight.evidence.slice(0, 2).join(" • ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Next actions" eyebrow="Coach output">
            <div className="list">
              {coachPlan.actions.map((action) => (
                <div key={`${action.label}-${action.priority}`} className="list-item stack">
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <div className="cluster">
                      <ListChecks size={17} />
                      <strong>{action.label}</strong>
                    </div>
                    <StatusPill label={action.priority} tone={action.priority === "high" ? "danger" : action.priority === "medium" ? "warning" : "success"} />
                  </div>
                  <div className="muted">{action.reason}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      <div className="grid-2" style={{ marginTop: 24 }}>
        <SectionCard title="Behaviour summary" eyebrow="Session focus report">
          <div className="list">
            <div className="list-item cluster" style={{ justifyContent: "space-between" }}>
              <span>Drowsy</span>
              <StatusPill label={`${results.drowsy_percent}%`} />
            </div>
            <div className="list-item cluster" style={{ justifyContent: "space-between" }}>
              <span>Talking</span>
              <StatusPill label={`${results.talking_percent}%`} />
            </div>
            <div className="list-item cluster" style={{ justifyContent: "space-between" }}>
              <span>Absent</span>
              <StatusPill label={`${results.absent_percent}%`} tone="danger" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Question review" eyebrow="Adaptive feedback">
          <div className="list">
            {results.attempts.map((attempt) => (
              <div key={attempt.id} className={`list-item stack review-card ${attempt.is_correct ? "review-card--correct" : "review-card--warning"}`.trim()}>
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <strong>{attempt.question.question_text}</strong>
                  <StatusPill label={attempt.is_correct ? "Correct" : "Needs review"} tone={attempt.is_correct ? "success" : "warning"} />
                </div>
                <div className="muted">
                  Your answer: {attempt.student_answer} • Correct answer: {attempt.correct_answer}
                </div>
                {!attempt.is_correct ? (
                  <div>{explanationMap.get(attempt.id) ?? attempt.explanation ?? "Explanation pending"}</div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
