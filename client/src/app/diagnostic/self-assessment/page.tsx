"use client";

import { PageState } from "@/components/ui/page-state";
import { SelfAssessmentScreen } from "@/features/diagnostic/self-assessment-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { contentApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function DiagnosticSelfAssessmentPage() {
  const { student, loading: authLoading } = useAuthGuard();
  const { data: subtopics, error, loading } = useAsyncResource(() => contentApi.getSubtopics(), []);

  if (authLoading || loading) {
    return (
      <PageState
        layout="auth"
        title="Loading subtopics"
        message="EduFX is preparing your self-assessment checklist."
        eyebrow="Diagnostic"
      />
    );
  }

  if (error) {
    return <PageState tone="error" title="Self-assessment could not load" message={error} />;
  }

  if (!student) {
    return null;
  }

  if (!subtopics?.length) {
    return <PageState tone="empty" title="No subtopics found" message="Seed the backend subtopic set and refresh this page." />;
  }

  return <SelfAssessmentScreen subtopics={subtopics} />;
}
