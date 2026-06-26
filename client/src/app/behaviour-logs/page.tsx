"use client";

import { PageState } from "@/components/ui/page-state";
import { BehaviourLogsScreen } from "@/features/behaviour/behaviour-logs-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { behaviourApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function BehaviourLogsPage() {
  const { student, loading: authLoading } = useAuthGuard();
  const { data: sessions, error, loading } = useAsyncResource(async () => {
      if (!student) {
        return null;
      }
      return behaviourApi.getHistory(student.student_id);
    },
    [student?.student_id]
  );

  if (authLoading || loading) {
    return <PageState title="Loading behaviour history" message="EduFX is collecting recent session summaries." />;
  }

  if (error) {
    return <PageState tone="error" title="Behaviour logs could not load" message={error} />;
  }

  return <BehaviourLogsScreen sessions={sessions ?? []} />;
}
