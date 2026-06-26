"use client";

import { PageState } from "@/components/ui/page-state";
import { ProgressScreen } from "@/features/progress/progress-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { progressApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function ProgressPage() {
  const { student, loading: authLoading } = useAuthGuard();
  const { data: progress, error, loading } = useAsyncResource(async () => {
      if (!student) {
        return null;
      }
      return progressApi.getAll(student.student_id);
    },
    [student?.student_id]
  );

  if (authLoading || loading) {
    return <PageState title="Loading learning map" message="EduFX is assembling your topic progress." />;
  }

  if (error) {
    return <PageState tone="error" title="Progress could not load" message={error} />;
  }

  return <ProgressScreen progress={progress ?? []} />;
}
