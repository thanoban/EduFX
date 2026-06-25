"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import type { DiagnosticResult } from "@/types/contracts";

export function DiagnosticResultsScreen({ results }: { results: DiagnosticResult[] }) {
  const router = useRouter();

  return (
    <AuthShell
      hero={
        <div className="stack">
          <span className="pill success"><CheckCircle2 size={15} /> Diagnostic complete</span>
          <h1>Your adaptive study map is ready.</h1>
          <p>Each subtopic now carries its own level, so the daily plan can target weak areas without slowing stronger ones down.</p>
        </div>
      }
    >
      <div className="stack">
        {results.map((item) => (
          <div className="list-item" key={item.subtopic_id}>
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{item.subtopic_title}</strong>
                <div className="muted">{item.score_percent}% diagnostic score</div>
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
        <Button icon={<ArrowRight size={17} />} onClick={() => router.push("/dashboard")}>Start learning</Button>
      </div>
    </AuthShell>
  );
}
