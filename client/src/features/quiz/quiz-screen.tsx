"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { useWebcamTracker } from "@/features/webcam/use-webcam-tracker";
import { STORAGE_KEYS } from "@/lib/constants";
import { writeStorage } from "@/lib/storage";
import { resultsApi } from "@/lib/api";
import type { QuizPayload, QuizResultPayload } from "@/types/contracts";

export function QuizScreen({ quiz }: { quiz: QuizPayload }) {
  const router = useRouter();
  const params = useSearchParams();
  const { student } = useAuthGuard();
  const tracker = useWebcamTracker();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const webcamEnabled = params.get("webcam") === "1";
  const activeQuestion = quiz.questions[activeIndex];

  useEffect(() => {
    if (!student) {
      return;
    }
    tracker.start(student.student_id, quiz.session_id, webcamEnabled);
    return () => {
      tracker.cancel();
    };
  }, [student, quiz.session_id, quiz.subtopic_id, tracker, webcamEnabled]);

  const answered = useMemo(
    () => quiz.questions.filter((question) => answers[question.id]).length,
    [answers, quiz.questions]
  );
  const completionPercent = Math.round((answered / Math.max(quiz.questions.length, 1)) * 100);

  async function handleSubmit() {
    if (!student) {
      return;
    }
    setBusy(true);
    try {
      await tracker.stop(student.student_id, quiz.session_id, quiz.subtopic_id, webcamEnabled);
      const result: QuizResultPayload = await resultsApi.submit(
        student.student_id,
        quiz.session_id,
        quiz.subtopic_id,
        webcamEnabled,
        quiz.questions.map((question) => ({
          question_id: question.id,
          student_answer: answers[question.id] ?? "A"
        }))
      );
      writeStorage(STORAGE_KEYS.lastSession, {
        sessionId: result.session_id,
        subtopicId: quiz.subtopic_id
      });
      writeStorage(STORAGE_KEYS.lastQuizResult, result);
      router.push(`/results/${result.session_id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={quiz.subtopic_title}
      subtitle={`${quiz.stage === "first" ? "Manual first attempt" : "Personalized repeat quiz"} • ${quiz.total_questions} questions`}
      action={<StatusPill label={webcamEnabled ? "Webcam on" : "Webcam off"} tone={webcamEnabled ? "success" : "warning"} />}
    >
      <div className="grid-2 diagnostic-layout">
        <aside className="section-card stack sticky-column">
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>Quiz navigator</h3>
              <div className="muted">
                {quiz.stage === "first" ? "Manual quality baseline" : "Repeat personalized run"}
              </div>
            </div>
            <span className="pill">{completionPercent}%</span>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="navigator-grid">
            {quiz.questions.map((question, index) => (
              <button
                key={question.id}
                className={`nav-dot ${
                  activeIndex === index ? "active" : answers[question.id] ? "done" : ""
                }`.trim()}
                onClick={() => setActiveIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="metric-stack">
            <div className="metric-inline">
              <span>Answered</span>
              <strong>{answered}/{quiz.questions.length}</strong>
            </div>
            <div className="metric-inline">
              <span>Webcam</span>
              <strong>{webcamEnabled ? "Enabled" : "Skipped"}</strong>
            </div>
            <div className="metric-inline">
              <span>Difficulty lane</span>
              <strong>{activeQuestion?.difficulty ?? "mixed"}</strong>
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
              <StatusPill label={activeQuestion.difficulty} />
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
            <div className="callout">
              Choose the strongest answer before moving on. You can revisit any question from the navigator
              at any time before submission.
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
                  disabled={activeIndex === quiz.questions.length - 1}
                  onClick={() =>
                    setActiveIndex((index) => Math.min(index + 1, quiz.questions.length - 1))
                  }
                >
                  Next
                </Button>
              </div>
              <Button onClick={handleSubmit} disabled={busy || answered !== quiz.questions.length}>
                Submit quiz
              </Button>
            </div>
          </article>
        ) : null}
      </div>
    </AppShell>
  );
}
