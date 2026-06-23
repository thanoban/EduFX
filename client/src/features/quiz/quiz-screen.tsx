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
import type { QuizPayload } from "@/types/contracts";

export function QuizScreen({ quiz }: { quiz: QuizPayload }) {
  const router = useRouter();
  const params = useSearchParams();
  const { student } = useAuthGuard();
  const tracker = useWebcamTracker();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const webcamEnabled = params.get("webcam") === "1";

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

  async function handleSubmit() {
    if (!student) {
      return;
    }
    setBusy(true);
    try {
      await tracker.stop(student.student_id, quiz.session_id, quiz.subtopic_id, webcamEnabled);
      const result = await resultsApi.submit(
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
      <SectionCard title="Session progress" eyebrow="Adaptive quiz">
        <div className="progress-bar">
          <span style={{ width: `${(answered / Math.max(quiz.questions.length, 1)) * 100}%` }} />
        </div>
        <div className="muted">
          {answered} of {quiz.questions.length} answered
        </div>
      </SectionCard>

      <div className="stack" style={{ marginTop: 20 }}>
        {quiz.questions.map((question, index) => (
          <article key={question.id} className="quiz-card stack">
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <strong>
                Q{index + 1}. {question.question_text}
              </strong>
              <StatusPill label={question.difficulty} />
            </div>
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
      </div>

      <div style={{ marginTop: 20 }}>
        <Button onClick={handleSubmit} disabled={busy}>
          Submit quiz
        </Button>
      </div>
    </AppShell>
  );
}
