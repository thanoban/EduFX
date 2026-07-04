"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, BookOpenCheck, CalendarCheck, Flame, Gauge, Target } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { ProgressRecord, StudentProfile, StudyPlanItem } from "@/types/contracts";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toBackendWeekday(date: Date) {
  return (date.getDay() + 6) % 7;
}

function nextFreeDayLabel(freeDays: number[], todayWeekday: number) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = (todayWeekday + offset) % 7;
    if (freeDays.includes(candidate)) {
      return offset === 1 ? "tomorrow" : DAY_NAMES[candidate];
    }
  }
  return null;
}

function buildDashboardBanner(student: StudentProfile | null, planLength: number) {
  if (!student) {
    return null;
  }
  const today = new Date();
  const todayWeekday = toBackendWeekday(today);
  const iso = todayIso();
  const studiedToday = student.last_study_date === iso;

  if (studiedToday) {
    return {
      tone: "success" as const,
      title: "Nice work — you've already studied today.",
      body: student.current_streak > 0
        ? `That keeps your ${student.current_streak}-day streak alive.`
        : "Come back tomorrow to start a new streak."
    };
  }

  if (student.free_days.length === 0) {
    return {
      tone: "default" as const,
      title: "Set your study availability",
      body: "Tell EduFX which days you're usually free in Settings so your daily plan fits your schedule."
    };
  }

  const isFreeToday = student.free_days.includes(todayWeekday);
  const isPromisedToday = student.next_expected_date === iso;

  if ((isFreeToday || isPromisedToday) && planLength > 0) {
    return {
      tone: "success" as const,
      title: "You said you're free today.",
      body: "Your plan below is sized to fit the time you have — no need to rush through everything at once."
    };
  }

  if (!isFreeToday && !isPromisedToday) {
    const nextDay = nextFreeDayLabel(student.free_days, todayWeekday);
    return {
      tone: "warning" as const,
      title: "No study planned today.",
      body: nextDay
        ? `Your next free day is ${nextDay}. Rest up, or study anyway if you have time.`
        : "Let EduFX know when you're next free from the Results screen or Settings."
    };
  }

  return null;
}

export function DashboardScreen({
  plan,
  progress
}: {
  plan: StudyPlanItem[];
  progress: ProgressRecord[];
}) {
  const router = useRouter();
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
  const banner = buildDashboardBanner(student, plan.length);

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Welcome back, ${student?.name ?? "student"} — here is your adaptive plan for today.`}
      action={
        <Button
          icon={<ArrowRight size={17} />}
          onClick={() => router.push(nextTopic ? `/study/${nextTopic.subtopic_id}` : "/diagnostic")}
        >
          {nextTopic ? "Start first topic" : "Open diagnostic"}
        </Button>
      }
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow"><Target size={14} /> Today's route</span>
          <h3>{nextTopic?.subtopic_title ?? "Diagnostic required"}</h3>
          <p className="muted">
            {nextTopic
              ? "Prioritised from recent performance, deadline pressure, and reinforcement balance."
              : "Complete the diagnostic once to unlock your first adaptive study route."}
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

      {banner ? (
        <div className="list-item cluster" style={{ justifyContent: "space-between", marginTop: 16 }}>
          <div className="cluster">
            <Flame size={18} />
            <div className="stack" style={{ gap: 2 }}>
              <strong>{banner.title}</strong>
              <span className="muted">{banner.body}</span>
            </div>
          </div>
          <StatusPill label={banner.tone === "success" ? "On track" : banner.tone === "warning" ? "Heads up" : "Setup"} tone={banner.tone} />
        </div>
      ) : null}

      <div className="grid-4">
        <StatCard icon={<BookOpenCheck size={18} />} label="Subtopics mastered" value={`${progress.filter((item) => item.current_level === "advanced").length}`} hint="Advanced level records" />
        <StatCard icon={<Gauge size={18} />} label="Average focus" value={`${averageFocus}%`} hint="Recent session trend" />
        <StatCard icon={<CalendarCheck size={18} />} label="Planned today" value={`${plan.length}`} hint="Scheduler-selected tasks" />
        <StatCard icon={<BarChart3 size={18} />} label="Sessions completed" value={`${progress.reduce((sum, item) => sum + item.total_sessions, 0)}`} hint="All recorded study runs" />
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <SectionCard title="Today's study plan" eyebrow="2 weak + 1 strong">
          <div className="list">
            {plan.length === 0 ? (
              <div className="list-item stack">
                <strong>No active plan yet</strong>
                <div className="muted">
                  EduFX needs diagnostic levels before it can schedule weak and strong subtopics.
                </div>
                <Button href="/diagnostic" icon={<ArrowRight size={16} />}>
                  Start diagnostic
                </Button>
              </div>
            ) : null}
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
                    <Button href={`/study/${item.subtopic_id}`} icon={<ArrowRight size={16} />}>
                      Study
                    </Button>
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
