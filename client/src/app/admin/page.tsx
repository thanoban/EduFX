"use client";

import { PageState } from "@/components/ui/page-state";
import { AdminStudentsScreen } from "@/features/admin/admin-students-screen";
import { useAdminGuard } from "@/features/auth/use-auth-guard";
import { adminApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function AdminPage() {
  const { student, token, loading: authLoading } = useAdminGuard();
  const { data: students, error, loading } = useAsyncResource(async () => {
    if (!student?.is_admin || !token) {
      return null;
    }
    return adminApi.listStudents(token);
  }, [student?.is_admin, token]);

  if (authLoading || loading) {
    return (
      <PageState
        layout="workspace"
        title="Loading admin portal"
        message="EduFX is gathering student performance data."
        eyebrow="Admin"
      />
    );
  }

  if (error) {
    return <PageState tone="error" title="Admin portal could not load" message={error} />;
  }

  return <AdminStudentsScreen students={students ?? []} />;
}
