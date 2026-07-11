"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { STORAGE_KEYS } from "@/lib/constants";
import { writeStorage } from "@/lib/storage";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { DiagnosticSelfAssessment, SelfAssessmentRating, Subtopic } from "@/types/contracts";

/**
 * Onboarding-only, self-rating step shown once before the diagnostic quiz.
 * "Weak" is trusted outright by the backend (beginner, no second-guessing);
 * "Confident" still gets checked against the actual diagnostic score, since
 * overconfidence risks placing a student in content too hard for them.
 */
export function SelfAssessmentScreen({ subtopics }: { subtopics: Subtopic[] }) {
  const router = useRouter();
  useAuthGuard();
  const [ratings, setRatings] = useState<Record<number, SelfAssessmentRating>>({});

  const rated = useMemo(() => Object.keys(ratings).length, [ratings]);
  const allRated = rated === subtopics.length && subtopics.length > 0;

  function rate(subtopicId: number, rating: SelfAssessmentRating) {
    setRatings((current) => ({ ...current, [subtopicId]: rating }));
  }

  function handleContinue() {
    const payload: DiagnosticSelfAssessment[] = subtopics.map((subtopic) => ({
      subtopic_id: subtopic.id,
      rating: ratings[subtopic.id]
    }));
    writeStorage(STORAGE_KEYS.selfAssessments, payload);
    router.push("/diagnostic");
  }

  return (
    <AppShell
      title="Before the diagnostic"
      subtitle="Rate yourself on each subtopic first — it helps EduFX set a fairer starting level."
      action={
        <Button icon={<ArrowRight size={16} />} onClick={handleContinue} disabled={!allRated}>
          Continue to diagnostic
        </Button>
      }
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow">
            <ClipboardCheck size={14} /> Step 1 of 2
          </span>
          <h3>How confident do you feel in each S-block subtopic?</h3>
          <p className="muted">
            If you say you&apos;re weak on a subtopic, EduFX starts you at beginner there no
            matter how the quiz goes. If you say you&apos;re confident, the diagnostic quiz
            score still decides your actual starting level.
          </p>
          <div className="progress-bar">
            <span style={{ width: `${subtopics.length ? Math.round((rated / subtopics.length) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{rated}</strong>
            <span>rated</span>
          </div>
          <div className="metric-box">
            <strong>{subtopics.length - rated}</strong>
            <span>remaining</span>
          </div>
        </div>
      </section>

      <SectionCard title="Rate each subtopic" eyebrow="One tap per row" action={<StatusPill label={`${rated}/${subtopics.length}`} tone={allRated ? "success" : "default"} />}>
        <div className="list">
          {subtopics.map((subtopic) => {
            const rating = ratings[subtopic.id];
            return (
              <div key={subtopic.id} className="list-item cluster" style={{ justifyContent: "space-between" }}>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>{subtopic.title}</strong>
                  <span className="muted">{subtopic.group_name}</span>
                </div>
                <div className="cluster" style={{ gap: 8 }}>
                  <Button
                    variant={rating === "weak" ? "primary" : "secondary"}
                    icon={<ThumbsDown size={16} />}
                    onClick={() => rate(subtopic.id, "weak")}
                  >
                    I&apos;m weak here
                  </Button>
                  <Button
                    variant={rating === "confident" ? "primary" : "secondary"}
                    icon={<ThumbsUp size={16} />}
                    onClick={() => rate(subtopic.id, "confident")}
                  >
                    I&apos;m confident
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Why this matters" eyebrow="Fairer starting point">
        <div className="list">
          <div className="list-item">
            <Sparkles size={14} /> A weak self-rating is trusted immediately — you never get
            placed above your own comfort level.
          </div>
          <div className="list-item">
            A confident self-rating is double-checked against your diagnostic score, so
            overconfidence doesn&apos;t start you somewhere too hard.
          </div>
        </div>
      </SectionCard>
    </AppShell>
  );
}
