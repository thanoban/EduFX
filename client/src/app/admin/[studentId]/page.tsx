"use client";

import { use } from "react";

import { PageState } from "@/components/ui/page-state";
import { AdminStudentDetailScreen } from "@/features/admin/admin-student-detail-screen";
import { useAdminGuard } from "@/features/auth/use-auth-guard";
import { adminApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function AdminStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const resolved = use(params);
  const { student, token, loading: authLoading } = useAdminGuard();
  const { data: detail, error, loading } = useAsyncResource(async () => {
    if (!student?.is_admin || !token) {
      return null;
    }
    return adminApi.getStudentDetail(token, Number(resolved.studentId));
  }, [resolved.studentId, student?.is_admin, token]);

  if (authLoading || loading) {
    return (
      <PageState
        layout="workspace"
        title="Loading student detail"
        message="EduFX is assembling this student's progress and history."
        eyebrow="Admin"
      />
    );
  }

  if (error || !detail) {
    return <PageState tone="error" title="Student detail could not load" message={error ?? "Student not found."} />;
  }

  return <AdminStudentDetailScreen detail={detail} />;
}
