"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { QuizResultPayload, SessionResults } from "@/types/contracts";

export function ResultsScreen({
  results,
  explanations,
  lastQuizResult
}: {
  results: SessionResults;
  explanations: Array<{ attempt_id: number; explanation: string }>;
  lastQuizResult: QuizResultPayload | null;
}) {
  useAuthGuard();
  const explanationMap = new Map(explanations.map((item) => [item.attempt_id, item.explanation]));
  const levelShiftLabel = lastQuizResult?.level_changed
    ? `${lastQuizResult.previous_level} -> ${lastQuizResult.new_level}`
    : `Stayed at ${lastQuizResult?.new_level ?? "current level"}`;

  return (
    <AppShell
      title="Session complete"
      subtitle="Review score, focus outcome, and AI explanations for any mistakes."
      action={
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      }
    >
      <section className="hero-strip hero-strip--success">
        <div className="hero-strip__copy">
          <span className="pill success">Adaptive review ready</span>
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
            <strong>{results.focus_score ?? 0}%</strong>
            <span>focus score</span>
          </div>
          <div className="metric-box">
            <strong>{levelShiftLabel}</strong>
            <span>level outcome</span>
          </div>
        </div>
      </section>

      <div className="grid-4">
        <StatCard label="Quiz score" value={`${results.quiz_score}%`} hint={`${results.correct_answers}/${results.total_questions} correct`} />
        <StatCard label="Focus score" value={`${results.focus_score ?? 0}%`} hint={results.webcam_enabled ? "Webcam summary enabled" : "Tracking skipped"} />
        <StatCard label="Phone alerts" value={`${results.phone_percent}%`} hint="Snapshot share" />
        <StatCard label="Away alerts" value={`${results.away_percent}%`} hint="Attention drift" />
      </div>

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
