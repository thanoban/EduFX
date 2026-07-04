"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAdminGuard } from "@/features/auth/use-auth-guard";
import { adminApi } from "@/lib/api";
import type { AdminStudentDetail } from "@/types/contracts";

export function AdminStudentDetailScreen({ detail: initialDetail }: { detail: AdminStudentDetail }) {
  const { student, token } = useAdminGuard();
  const [detail, setDetail] = useState(initialDetail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = student?.email === detail.email;

  async function toggleRole() {
    if (!token || isSelf) {
      return;
    }
    const nextRole = detail.role === "admin" ? "student" : "admin";
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.setStudentRole(token, detail.student_id, nextRole);
      setDetail(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this student's role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={detail.name}
      subtitle={detail.email}
      action={
        <div className="stack admin-role-actions">
          <Button
            variant={detail.role === "admin" ? "secondary" : "primary"}
            icon={detail.role === "admin" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
            onClick={toggleRole}
            disabled={busy || isSelf}
          >
            {detail.role === "admin" ? "Revoke admin" : "Make admin"}
          </Button>
          {isSelf ? <span className="muted small-text">You can&apos;t change your own role.</span> : null}
          {error ? <span className="auth-error">{error}</span> : null}
        </div>
      }
    >
      <div className="cluster" style={{ marginBottom: 20 }}>
        <StatusPill
          label={detail.role === "admin" ? "Admin" : "Student"}
          tone={detail.role === "admin" ? "success" : "default"}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <SectionCard title="Per-subtopic progress" eyebrow={`${detail.progress.length} subtopics`}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Subtopic</th>
                  <th>Level</th>
                  <th>Last score</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {detail.progress.map((item) => (
                  <tr key={item.subtopic_id}>
                    <td>{item.subtopics.title}</td>
                    <td>
                      <StatusPill label={item.current_level} />
                    </td>
                    <td>{item.last_quiz_score}%</td>
                    <td>{item.total_sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Weak concepts" eyebrow={`${detail.weak_concepts.length} flagged`}>
          {detail.weak_concepts.length === 0 ? (
            <p className="muted">
              No weak concepts detected — either the student is doing well, or there isn&apos;t
              enough concept-tagged quiz history yet.
            </p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {detail.weak_concepts.map((wc) => (
                <div key={wc.concept} className="list-item cluster" style={{ justifyContent: "space-between" }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <strong>{wc.concept}</strong>
                    {wc.sample_question ? <span className="muted small-text">{wc.sample_question}</span> : null}
                  </div>
                  <StatusPill
                    label={`${Math.round(wc.accuracy * 100)}% (${wc.correct}/${wc.attempts})`}
                    tone={wc.accuracy < 0.4 ? "danger" : "warning"}
                  />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Session history" eyebrow={`${detail.session_history.length} sessions`}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subtopic</th>
                <th>Quiz score</th>
                <th>Focus score</th>
              </tr>
            </thead>
            <tbody>
              {detail.session_history.map((session) => (
                <tr key={session.session_id}>
                  <td>{session.session_date}</td>
                  <td>{session.subtopic_title}</td>
                  <td>{session.quiz_score}%</td>
                  <td>{session.focus_score !== null ? `${session.focus_score}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
