"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Gauge, Target, Trophy } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { DiagnosticResult } from "@/types/contracts";

export function DiagnosticResultsScreen({ results }: { results: DiagnosticResult[] }) {
  const router = useRouter();
  const advancedCount = results.filter((item) => item.assigned_level === "advanced").length;
  const intermediateCount = results.filter((item) => item.assigned_level === "intermediate").length;
  const beginnerCount = results.filter((item) => item.assigned_level === "beginner").length;
  const averageScore = results.length
    ? Math.round(results.reduce((sum, item) => sum + item.score_percent, 0) / results.length)
    : 0;

  return (
    <AuthShell
      hero={
        <div className="stack">
          <span className="pill success"><CheckCircle2 size={15} /> Diagnostic complete</span>
          <h1>Your adaptive study map is ready.</h1>
          <p>
            Each subtopic now carries its own level, so the daily plan can target weak areas
            without slowing stronger ones down.
          </p>
          <div className="hero-metrics">
            <div className="hero-metric">
              <strong>{results.length}</strong>
              <span>subtopics assessed</span>
            </div>
            <div className="hero-metric">
              <strong>{averageScore}%</strong>
              <span>average score</span>
            </div>
            <div className="hero-metric">
              <strong>{advancedCount}</strong>
              <span>advanced starting lanes</span>
            </div>
          </div>
        </div>
      }
    >
      <div className="stack">
        <div className="grid-3">
          <StatCard icon={<Target size={18} />} label="Beginner" value={`${beginnerCount}`} hint="Need guided foundations" />
          <StatCard icon={<Gauge size={18} />} label="Intermediate" value={`${intermediateCount}`} hint="Ready for steady progression" />
          <StatCard icon={<Trophy size={18} />} label="Advanced" value={`${advancedCount}`} hint="Can move into reinforcement" />
        </div>

        <div className="callout">
          EduFX will use these starting levels to balance today&apos;s plan between weak areas and
          strong areas that still need light reinforcement.
        </div>

        {results.map((item) => (
          <div className="list-item diagnostic-result-card" key={item.subtopic_id}>
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <div className="stack" style={{ gap: 6 }}>
                <strong>{item.subtopic_title}</strong>
                <div className="muted">{item.score_percent}% diagnostic score</div>
                <div className="focus-bar focus-bar--wide">
                  <span style={{ width: `${Math.max(item.score_percent, 8)}%` }} />
                </div>
              </div>
              <StatusPill
                label={item.assigned_level}
                tone={
                  item.assigned_level === "advanced"
                    ? "success"
                    : item.assigned_level === "intermediate"
                      ? "warning"
                      : "danger"
                }
              />
            </div>
          </div>
        ))}
        <Button icon={<ArrowRight size={17} />} onClick={() => router.push("/dashboard")}>
          Open dashboard
        </Button>
      </div>
    </AuthShell>
  );
}
