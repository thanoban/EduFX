"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { ProgressRecord, StudyPlanItem } from "@/types/contracts";

export function DashboardScreen({
  plan,
  progress
}: {
  plan: StudyPlanItem[];
  progress: ProgressRecord[];
}) {
  const { student } = useAuthGuard();
  const weakCount = progress.filter((item) => item.current_level !== "advanced").length;
  const masteryCount = progress.filter((item) => item.current_level === "advanced").length;
  const averageFocus = progress.length
    ? Math.round(
        progress.reduce((sum, item) => sum + (item.session_history[0]?.focus_score ?? 85), 0) /
          progress.length
      )
    : 0;
  const nextTopic = plan[0];

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Welcome back, ${student?.name ?? "student"} — here is your adaptive plan for today.`}
      action={<Button onClick={() => (window.location.href = `/study/${nextTopic?.subtopic_id ?? 1}`)}>Start today's first topic</Button>}
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="pill">Today's adaptive route</span>
          <h3>{nextTopic?.subtopic_title ?? "Your plan is loading"}</h3>
          <p className="muted">
            The scheduler picked two weak areas and one stronger reinforcement topic to balance momentum
            with retention.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{weakCount}</strong>
            <span>weak zones</span>
          </div>
          <div className="metric-box">
            <strong>{masteryCount}</strong>
            <span>advanced topics</span>
          </div>
          <div className="metric-box">
            <strong>{averageFocus}%</strong>
            <span>focus trend</span>
          </div>
        </div>
      </section>

      <div className="grid-4">
        <StatCard label="Subtopics mastered" value={`${progress.filter((item) => item.current_level === "advanced").length}`} hint="Advanced level records" />
        <StatCard label="Average focus" value={`${averageFocus}%`} hint="Recent session trend" />
        <StatCard label="Planned today" value={`${plan.length}`} hint="Scheduler-selected tasks" />
        <StatCard label="Sessions completed" value={`${progress.reduce((sum, item) => sum + item.total_sessions, 0)}`} hint="All recorded study runs" />
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <SectionCard title="Today's study plan" eyebrow="2 weak + 1 strong">
          <div className="list">
            {plan.map((item) => (
              <div key={item.subtopic_id} className="list-item focus-card">
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <div className="stack">
                    <strong>{item.subtopic_title}</strong>
                    <div className="muted">
                      {item.group_name} • last quiz {item.last_quiz_score}% • {item.type} lane
                    </div>
                    <div className="focus-bar">
                      <span style={{ width: `${Math.max(item.last_quiz_score, 10)}%` }} />
                    </div>
                  </div>
                  <div className="cluster">
                    <StatusPill label={item.current_level} />
                    {item.is_overdue ? <StatusPill label="Deadline override" tone="danger" /> : null}
                    <Link href={`/study/${item.subtopic_id}`}>
                      <Button>Open study page</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Level distribution" eyebrow="Progress overview">
          <div className="list">
            {progress.map((item) => (
              <div key={item.subtopic_id} className="list-item cluster" style={{ justifyContent: "space-between" }}>
                <div className="stack" style={{ gap: 8 }}>
                  <strong>{item.subtopics.title}</strong>
                  <div className="muted">{item.total_sessions} sessions completed</div>
                  <div className="focus-bar focus-bar--compact">
                    <span style={{ width: `${Math.max(item.last_quiz_score, 8)}%` }} />
                  </div>
                </div>
                <StatusPill
                  label={item.current_level}
                  tone={
                    item.current_level === "advanced"
                      ? "success"
                      : item.current_level === "intermediate"
                        ? "warning"
                        : "default"
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
