"use client";

import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { BehaviourHistoryItem } from "@/types/contracts";
import { Activity, AlertTriangle, Camera, Gauge } from "lucide-react";

export function BehaviourLogsScreen({ sessions }: { sessions: BehaviourHistoryItem[] }) {
  useAuthGuard();
  const trackedSessions = sessions.filter((session) => session.webcam_enabled);
  const averageFocus = trackedSessions.length
    ? Math.round(
        trackedSessions.reduce((sum, session) => sum + (session.focus_score ?? 0), 0) /
          trackedSessions.length
      )
    : null;
  const flaggedSessions = sessions.filter(
    (session) => session.phone_percent > 0 || session.away_percent > 20 || session.absent_percent > 0
  ).length;

  return (
    <AppShell
      title="Behaviour logs"
      subtitle="Snapshot-driven focus records captured during quiz sessions."
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow"><Activity size={14} /> Focus telemetry</span>
          <h3>Review attention patterns across study sessions.</h3>
          <p className="muted">
            EduFX keeps webcam analysis local and stores only the session summary signals that help
            you understand distraction trends over time.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{sessions.length}</strong>
            <span>recorded sessions</span>
          </div>
          <div className="metric-box">
            <strong>{averageFocus !== null ? `${averageFocus}%` : "N/A"}</strong>
            <span>average tracked focus</span>
          </div>
          <div className="metric-box">
            <strong>{flaggedSessions}</strong>
            <span>sessions with alerts</span>
          </div>
        </div>
      </section>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard
          icon={<Camera size={18} />}
          label="Tracked sessions"
          value={`${trackedSessions.length}`}
          hint="Sessions with webcam analysis enabled"
        />
        <StatCard
          icon={<Gauge size={18} />}
          label="Focus average"
          value={averageFocus !== null ? `${averageFocus}%` : "N/A"}
          hint="Only counted when tracking was enabled"
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Flagged sessions"
          value={`${flaggedSessions}`}
          hint="Phone, away, or absent alerts detected"
        />
      </div>

      <SectionCard title="Recent sessions" eyebrow="Focus history" action={<Activity size={18} />}>
        <div className="list">
          {sessions.length === 0 ? (
            <div className="list-item stack">
              <strong>No behaviour logs yet</strong>
              <div className="muted">
                Focus summaries will appear here after you complete quiz sessions with or without
                webcam tracking enabled.
              </div>
            </div>
          ) : null}
          {sessions.map((session) => (
            <div key={session.id} className="list-item stack behaviour-session-card">
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <div className="stack" style={{ gap: 6 }}>
                  <strong>{session.subtopics?.title ?? "Study session"}</strong>
                  <div className="muted">
                    Quiz {session.quiz_score}% • {session.correct_answers}/{session.total_questions} correct
                  </div>
                </div>
                <StatusPill
                  label={session.webcam_enabled ? "Tracked" : "Skipped"}
                  tone={session.webcam_enabled ? "success" : "warning"}
                />
              </div>
              <div className="grid-3 behaviour-session-card__metrics">
                <div className="topic-summary">
                  <strong>{session.webcam_enabled && session.focus_score !== null ? `${session.focus_score}%` : "N/A"}</strong>
                  <p className="muted">focus score</p>
                </div>
                <div className="topic-summary">
                  <strong>{session.phone_percent}%</strong>
                  <p className="muted">phone alerts</p>
                </div>
                <div className="topic-summary">
                  <strong>{session.away_percent}%</strong>
                  <p className="muted">looking away</p>
                </div>
              </div>
              <div className="cluster" style={{ gap: 8 }}>
                {session.absent_percent > 0 ? <StatusPill label={`Absent ${session.absent_percent}%`} tone="danger" /> : null}
                {session.sleeping_percent > 0 ? <StatusPill label={`Sleeping ${session.sleeping_percent}%`} tone="danger" /> : null}
                {session.tab_switch_percent > 0 ? (
                  <StatusPill label={`Tab switched ${session.tab_switch_percent}%`} tone="danger" />
                ) : null}
                {session.talking_percent > 0 ? <StatusPill label={`Talking ${session.talking_percent}%`} tone="warning" /> : null}
                {session.other_voice_percent > 0 ? (
                  <StatusPill label={`Other voice ${session.other_voice_percent}%`} tone="warning" />
                ) : null}
                {session.object_percent > 0 ? <StatusPill label={`Notes/device ${session.object_percent}%`} tone="warning" /> : null}
                {session.drowsy_percent > 0 ? <StatusPill label={`Drowsy ${session.drowsy_percent}%`} tone="warning" /> : null}
                {session.phone_percent === 0 &&
                session.away_percent <= 20 &&
                session.absent_percent === 0 &&
                session.talking_percent === 0 &&
                session.other_voice_percent === 0 &&
                session.object_percent === 0 &&
                session.sleeping_percent === 0 &&
                session.tab_switch_percent === 0 &&
                session.drowsy_percent === 0 ? (
                  <StatusPill label="Steady session" tone="success" />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
