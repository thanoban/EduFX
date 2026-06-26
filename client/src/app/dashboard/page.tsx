"use client";

import { PageState } from "@/components/ui/page-state";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { progressApi, schedulerApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function DashboardPage() {
  const { student, loading: authLoading } = useAuthGuard();
  const { data, error, loading } = useAsyncResource(async () => {
      if (!student) {
        return null;
      }
      const [plan, progress] = await Promise.all([
        schedulerApi.getPlan(student.student_id),
        progressApi.getAll(student.student_id)
      ]);
      return { plan, progress };
    },
    [student?.student_id]
  );

  if (authLoading || loading) {
    return <PageState title="Preparing your workspace" message="EduFX is loading your dashboard, plan, and progress." />;
  }

  if (error) {
    return <PageState tone="error" title="Dashboard could not load" message={error} />;
  }

  return <DashboardScreen plan={data?.plan ?? []} progress={data?.progress ?? []} />;
}
