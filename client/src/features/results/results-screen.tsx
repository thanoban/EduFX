"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { SessionResults } from "@/types/contracts";

export function ResultsScreen({
  results,
  explanations
}: {
  results: SessionResults;
  explanations: Array<{ attempt_id: number; explanation: string }>;
}) {
  useAuthGuard();
  const explanationMap = new Map(explanations.map((item) => [item.attempt_id, item.explanation]));

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
              <div key={attempt.id} className="list-item stack">
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
