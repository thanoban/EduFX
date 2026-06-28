"use client";

import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import type { BehaviourHistoryItem } from "@/types/contracts";
import { Activity } from "lucide-react";

export function BehaviourLogsScreen({ sessions }: { sessions: BehaviourHistoryItem[] }) {
  useAuthGuard();

  return (
    <AppShell
      title="Behaviour logs"
      subtitle="Snapshot-driven focus records captured during quiz sessions."
    >
      <SectionCard title="Recent sessions" eyebrow="Focus history" action={<Activity size={18} />}>
        <div className="list">
          {sessions.map((session) => (
            <div key={session.id} className="list-item cluster" style={{ justifyContent: "space-between" }}>
              <div className="stack">
                <strong>{session.subtopics?.title ?? "Study session"}</strong>
                <div className="muted">
                  Focus {session.webcam_enabled && session.focus_score !== null ? `${session.focus_score}%` : "not tracked"} • phone {session.phone_percent}% • away {session.away_percent}%
                </div>
              </div>
              <StatusPill label={session.webcam_enabled ? "Tracked" : "Skipped"} tone={session.webcam_enabled ? "success" : "warning"} />
            </div>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
