"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
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
        <Link href={`/webcam-check?subtopic=${content.subtopic_id}`}>
          <Button icon={<ArrowRight size={17} />}>Finish reading</Button>
        </Link>
      }
    >
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
