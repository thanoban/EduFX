"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { diagnosticApi } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { writeStorage } from "@/lib/storage";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { DiagnosticQuestion } from "@/types/contracts";

export function DiagnosticScreen({ questions }: { questions: DiagnosticQuestion[] }) {
  const router = useRouter();
  const { student, refreshStatus } = useAuthGuard();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const completed = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions]
  );

  async function handleSubmit() {
    if (!student) {
      return;
    }
    setBusy(true);
    try {
      const payload = await diagnosticApi.submit(
        student.student_id,
        questions.map((question) => ({
          question_id: question.id,
          subtopic_id: question.subtopic_id,
          student_answer: answers[question.id] ?? "A"
        }))
      );
      writeStorage(STORAGE_KEYS.lastDiagnostic, payload.results);
      await refreshStatus();
      router.push("/diagnostic/results");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      hero={
        <div className="stack">
          <span className="pill">Step 1</span>
          <h1>Diagnostic assessment</h1>
          <p>
            This first-run diagnostic assigns a starting difficulty level for each of the ten chemistry
            subtopics in the S-block unit.
          </p>
          <div className="progress-bar">
            <span style={{ width: `${(completed / Math.max(questions.length, 1)) * 100}%` }} />
          </div>
          <div className="muted">
            {completed} of {questions.length} answered
          </div>
        </div>
      }
    >
      <div className="stack">
        {questions.map((question, index) => (
          <article key={question.id} className="quiz-card stack">
            <div className="muted">Question {index + 1}</div>
            <strong>{question.question_text}</strong>
            <div className="grid-2">
              {(["A", "B", "C", "D"] as const).map((option) => {
                const label = {
                  A: question.option_a,
                  B: question.option_b,
                  C: question.option_c,
                  D: question.option_d
                }[option];
                return (
                  <button
                    key={option}
                    className={`option-card ${answers[question.id] === option ? "active" : ""}`.trim()}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option
                      }))
                    }
                  >
                    {option}. {label}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
        <Button onClick={handleSubmit} disabled={busy}>
          Submit diagnostic
        </Button>
      </div>
    </AuthShell>
  );
}
