"use client";

import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { ProgressRecord } from "@/types/contracts";

export function ProgressScreen({ progress }: { progress: ProgressRecord[] }) {
  useAuthGuard();

  return (
    <AppShell
      title="Progress"
      subtitle="Subtopic-by-subtopic levels, score history, and study cadence."
    >
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
                  <td>{item.subtopics.title}</td>
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
