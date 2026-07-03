"use client";

import ReactMarkdown from "react-markdown";
import { ArrowRight, BookOpen, CheckCircle2, FlaskConical, Gauge } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { ContentRecord } from "@/types/contracts";

export function StudyScreen({ content }: { content: ContentRecord }) {
  useAuthGuard();

  return (
    <AppShell
      title={content.subtopic_title}
      subtitle={`Content tuned for ${content.level} level in ${content.group_name}.`}
      action={
        <Button href={`/webcam-check?subtopic=${content.subtopic_id}`} icon={<ArrowRight size={17} />}>
          Finish reading
        </Button>
      }
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow"><BookOpen size={14} /> Level-aware study note</span>
          <h3>Study the concept, then move into a short quiz while it is fresh.</h3>
          <p className="muted">
            This note is aligned to your current level so the next quiz can focus on understanding,
            not just repetition.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{content.level}</strong>
            <span>current level</span>
          </div>
          <div className="metric-box">
            <strong>{content.group_name}</strong>
            <span>curriculum lane</span>
          </div>
          <div className="metric-box">
            <strong>Quiz next</strong>
            <span>webcam tracking optional</span>
          </div>
        </div>
      </section>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard icon={<FlaskConical size={18} />} label="Subtopic" value={String(content.subtopic_id)} hint={content.subtopic_title} />
        <StatCard icon={<Gauge size={18} />} label="Difficulty lane" value={content.level} hint="Personalized from your progress" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Next step" value="Quiz" hint="Start after you finish the note" />
      </div>

      <div className="grid-2">
        <SectionCard title="Study notes" eyebrow="Level-aware content" action={<BookOpen size={18} />}>
          <div className="markdown">
            <ReactMarkdown>{content.body}</ReactMarkdown>
          </div>
        </SectionCard>
        <SectionCard title="Session checklist" eyebrow="Before quiz" action={<CheckCircle2 size={18} />}>
          <div className="stack">
            <StatusPill label={`Current level: ${content.level}`} />
            <div className="topic-summary">
              <strong>Learning target</strong>
              <p className="muted">
                Focus on the key trend, one memorable example, and one contrast you can explain in your
                own words before starting the quiz.
              </p>
            </div>
            <div className="list-item">Read the full note and keep the key trends in mind.</div>
            <div className="list-item">Choose whether to enable webcam tracking for focus metrics.</div>
            <div className="list-item">The first attempt uses manual questions; repeats switch to personalized generation.</div>
            <div className="callout success-callout">
              The quiz unlocks a focus summary and AI explanations after submission, so the goal is not
              only accuracy but also a clean study routine.
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
