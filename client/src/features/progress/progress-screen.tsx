"use client";

import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { ProgressRecord } from "@/types/contracts";

export function ProgressScreen({ progress }: { progress: ProgressRecord[] }) {
  useAuthGuard();
  const advancedCount = progress.filter((item) => item.current_level === "advanced").length;
  const beginnerCount = progress.filter((item) => item.current_level === "beginner").length;
  const sessionTotal = progress.reduce((sum, item) => sum + item.total_sessions, 0);

  return (
    <AppShell
      title="Progress"
      subtitle="Subtopic-by-subtopic levels, score history, and study cadence."
    >
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <article className="stat-card">
          <div className="muted">Advanced topics</div>
          <strong>{advancedCount}</strong>
          <div className="muted">Ready for reinforcement</div>
        </article>
        <article className="stat-card">
          <div className="muted">Beginner topics</div>
          <strong>{beginnerCount}</strong>
          <div className="muted">Need guided practice</div>
        </article>
        <article className="stat-card">
          <div className="muted">Total sessions</div>
          <strong>{sessionTotal}</strong>
          <div className="muted">Recorded across all subtopics</div>
        </article>
      </div>
      <SectionCard title="Learning map" eyebrow="10 subtopics">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Subtopic</th>
                <th>Level</th>
                <th>Last score</th>
                <th>Sessions</th>
                <th>Recent trend</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((item) => (
                <tr key={item.subtopic_id}>
                  <td>
                    <div className="stack" style={{ gap: 6 }}>
                      <strong>{item.subtopics.title}</strong>
                      <div className="focus-bar focus-bar--compact">
                        <span style={{ width: `${Math.max(item.last_quiz_score, 8)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill label={item.current_level} />
                  </td>
                  <td>{item.last_quiz_score}%</td>
                  <td>{item.total_sessions}</td>
                  <td>{item.session_history[0]?.quiz_score ?? 0}% latest</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
