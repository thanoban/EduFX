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
  const [activeIndex, setActiveIndex] = useState(0);

  const activeQuestion = questions[activeIndex];

  const completed = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions]
  );
  const remaining = questions.length - completed;
  const currentGroupLabel = activeQuestion
    ? `Subtopic ${activeQuestion.subtopic_id}`
    : "Diagnostic";

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
          <div className="hero-metrics">
            <div className="hero-metric">
              <strong>{completed}</strong>
              <span>answered</span>
            </div>
            <div className="hero-metric">
              <strong>{remaining}</strong>
              <span>remaining</span>
            </div>
            <div className="hero-metric">
              <strong>{activeIndex + 1}</strong>
              <span>current</span>
            </div>
          </div>
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
        <div className="grid-2 diagnostic-layout">
          <aside className="section-card stack sticky-column">
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <div>
                <h3>Question map</h3>
                <div className="muted">{currentGroupLabel}</div>
              </div>
              <span className="pill">{completed}/{questions.length}</span>
            </div>
            <div className="navigator-grid">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  className={`nav-dot ${
                    activeIndex === index
                      ? "active"
                      : answers[question.id]
                        ? "done"
                        : ""
                  }`.trim()}
                  onClick={() => setActiveIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="stack">
              <div className="list-item">
                EduFX checks four diagnostic questions per subtopic before assigning a level.
              </div>
              <div className="list-item">
                All 40 answers are required before the adaptive study plan unlocks.
              </div>
            </div>
          </aside>

          {activeQuestion ? (
            <article className="quiz-card stack">
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <div className="stack" style={{ gap: 6 }}>
                  <span className="pill">Question {activeIndex + 1}</span>
                  <strong>{activeQuestion.question_text}</strong>
                </div>
                <StatusBadge answered={Boolean(answers[activeQuestion.id])} />
              </div>
              <div className="grid-2">
                {(["A", "B", "C", "D"] as const).map((option) => {
                  const label = {
                    A: activeQuestion.option_a,
                    B: activeQuestion.option_b,
                    C: activeQuestion.option_c,
                    D: activeQuestion.option_d
                  }[option];
                  return (
                    <button
                      key={option}
                      className={`option-card ${answers[activeQuestion.id] === option ? "active" : ""}`.trim()}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [activeQuestion.id]: option
                        }))
                      }
                    >
                      {option}. {label}
                    </button>
                  );
                })}
              </div>
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <div className="cluster">
                  <Button
                    variant="secondary"
                    disabled={activeIndex === 0}
                    onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={activeIndex === questions.length - 1}
                    onClick={() =>
                      setActiveIndex((index) => Math.min(index + 1, questions.length - 1))
                    }
                  >
                    Next
                  </Button>
                </div>
                <Button onClick={handleSubmit} disabled={busy || completed !== questions.length}>
                  Submit diagnostic
                </Button>
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}

function StatusBadge({ answered }: { answered: boolean }) {
  return (
    <span className={`pill ${answered ? "success" : "warning"}`.trim()}>
      {answered ? "Answered" : "Pending"}
    </span>
  );
}
