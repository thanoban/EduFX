"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAdminGuard } from "@/features/auth/use-auth-guard";
import type { AdminStudentSummary } from "@/types/contracts";
import { GraduationCap, Target, Users } from "lucide-react";

export function AdminStudentsScreen({ students }: { students: AdminStudentSummary[] }) {
  useAdminGuard();

  const totalStudents = students.length;
  const focusScores = students
    .map((s) => s.avg_focus_score)
    .filter((value): value is number => value !== null);
  const avgFocus = focusScores.length
    ? Math.round(focusScores.reduce((sum, v) => sum + v, 0) / focusScores.length)
    : null;
  const avgMastered = totalStudents
    ? Math.round((students.reduce((sum, s) => sum + s.subtopics_mastered, 0) / totalStudents) * 10) / 10
    : 0;

  return (
    <AppShell title="Admin" subtitle="All students, their progress, and where they need help.">
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <StatCard label="Total students" value={String(totalStudents)} hint="Signed up so far" icon={<Users size={18} />} />
        <StatCard
          label="Avg. mastered subtopics"
          value={String(avgMastered)}
          hint="Out of 10 subtopics"
          icon={<GraduationCap size={18} />}
        />
        <StatCard
          label="Avg. focus score"
          value={avgFocus !== null ? `${avgFocus}%` : "No data"}
          hint="Across tracked sessions"
          icon={<Target size={18} />}
        />
      </div>

      <SectionCard title="All students" eyebrow={`${totalStudents} total`}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Diagnostic</th>
                <th>Mastered</th>
                <th>Avg. focus</th>
                <th>Sessions</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.student_id}>
                  <td>
                    <Link href={`/admin/${student.student_id}`}>
                      <strong>{student.name}</strong>
                    </Link>
                  </td>
                  <td className="muted">{student.email}</td>
                  <td>
                    <StatusPill
                      label={student.role === "admin" ? "Admin" : "Student"}
                      tone={student.role === "admin" ? "success" : "default"}
                    />
                  </td>
                  <td>
                    <StatusPill
                      label={student.diagnostic_completed ? "Completed" : "Pending"}
                      tone={student.diagnostic_completed ? "success" : "warning"}
                    />
                  </td>
                  <td>{student.subtopics_mastered} / 10</td>
                  <td>{student.avg_focus_score !== null ? `${student.avg_focus_score}%` : "—"}</td>
                  <td>{student.total_sessions}</td>
                  <td className="muted">{student.last_active_date ?? "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
