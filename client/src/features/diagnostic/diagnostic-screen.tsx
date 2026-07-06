"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  Layers3,
  Send,
  Target
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
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
  const completionPercent = Math.round((completed / Math.max(questions.length, 1)) * 100);
  const currentGroupLabel = activeQuestion
    ? `Subtopic ${activeQuestion.subtopic_id}`
    : "Diagnostic";
  const subtopicQuestionCount = useMemo(
    () =>
      activeQuestion
        ? questions.filter((question) => question.subtopic_id === activeQuestion.subtopic_id).length
        : 0,
    [activeQuestion, questions]
  );
  const subtopicAnsweredCount = useMemo(
    () =>
      activeQuestion
        ? questions.filter(
            (question) =>
              question.subtopic_id === activeQuestion.subtopic_id && Boolean(answers[question.id])
          ).length
        : 0,
    [activeQuestion, answers, questions]
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
    <AppShell
      title="Diagnostic assessment"
      subtitle="Complete the 40-question placement check once so EduFX can set your starting level for each S-block subtopic."
      action={
        <Button
          icon={<Send size={16} />}
          onClick={handleSubmit}
          disabled={busy || completed !== questions.length}
        >
          {busy ? "Submitting..." : "Submit diagnostic"}
        </Button>
      }
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow">
            <ClipboardCheck size={14} /> Step 1 of 2
          </span>
          <h3>Map your current chemistry level before the adaptive plan unlocks.</h3>
          <p className="muted">
            Each subtopic gets four short checks. Once all 40 are complete, EduFX can
            balance weak zones, revision timing, and next-topic readiness.
          </p>
          <div className="progress-bar">
            <span style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{completed}</strong>
            <span>answered</span>
          </div>
          <div className="metric-box">
            <strong>{remaining}</strong>
            <span>remaining</span>
          </div>
          <div className="metric-box">
            <strong>{activeIndex + 1}</strong>
            <span>current question</span>
          </div>
        </div>
      </section>

      <div className="grid-4" style={{ marginTop: 18 }}>
        <StatCard
          icon={<BookOpenCheck size={18} />}
          label="Questions complete"
          value={`${completed}/${questions.length}`}
          hint="Every answer is required"
        />
        <StatCard
          icon={<Layers3 size={18} />}
          label="Current subtopic"
          value={activeQuestion ? `${activeQuestion.subtopic_id}` : "-"}
          hint={`${subtopicAnsweredCount}/${subtopicQuestionCount || 0} answered in this lane`}
        />
        <StatCard
          icon={<Target size={18} />}
          label="Completion"
          value={`${completionPercent}%`}
          hint="Live progress through the diagnostic"
        />
        <StatCard
          icon={<ClipboardCheck size={18} />}
          label="Questions left"
          value={`${remaining}`}
          hint="Finish all 40 to unlock the plan"
        />
      </div>

      <div className="grid-2 diagnostic-workspace" style={{ marginTop: 24 }}>
        {activeQuestion ? (
          <SectionCard
            title={activeQuestion.question_text}
            eyebrow={`Question ${activeIndex + 1} of ${questions.length}`}
            action={
              <StatusPill
                label={answers[activeQuestion.id] ? "Answered" : "Pending"}
                tone={answers[activeQuestion.id] ? "success" : "warning"}
              />
            }
          >
            <div className="stack">
              <div className="diagnostic-question-meta">
                <StatusPill label={currentGroupLabel} />
                <StatusPill
                  label={`${subtopicAnsweredCount}/${subtopicQuestionCount || 0} complete in this subtopic`}
                  tone="default"
                />
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
                      <span className="option-card__letter">{option}</span>
                      <span className="option-card__body">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="cluster question-actions">
                <div className="cluster question-actions__group">
                  <Button
                    variant="secondary"
                    icon={<ArrowLeft size={16} />}
                    disabled={activeIndex === 0}
                    onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<ArrowRight size={16} />}
                    disabled={activeIndex === questions.length - 1}
                    onClick={() =>
                      setActiveIndex((index) => Math.min(index + 1, questions.length - 1))
                    }
                  >
                    Next
                  </Button>
                </div>
                <Button
                  icon={<Send size={16} />}
                  onClick={handleSubmit}
                  disabled={busy || completed !== questions.length}
                >
                  {busy ? "Submitting..." : "Submit diagnostic"}
                </Button>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <div className="stack diagnostic-sidebar">
          <SectionCard
            title="Question map"
            eyebrow="Navigator"
            action={<StatusPill label={`${completed}/${questions.length}`} tone="default" />}
          >
            <div className="navigator-grid">
              {questions.map((question, index) => (
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
          </SectionCard>

          <SectionCard title="How EduFX uses this" eyebrow="Before the dashboard">
            <div className="list">
              <div className="list-item">
                Four diagnostic questions are used to estimate a starting level for each
                subtopic.
              </div>
              <div className="list-item">
                Those starting levels feed the recommender, which later balances weak,
                overdue, and ready-to-learn topics.
              </div>
              <div className="list-item">
                All 40 answers must be complete before the adaptive study plan unlocks.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
