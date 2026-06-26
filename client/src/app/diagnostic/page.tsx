"use client";

import { PageState } from "@/components/ui/page-state";
import { DiagnosticScreen } from "@/features/diagnostic/diagnostic-screen";
import { diagnosticApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function DiagnosticPage() {
  const { data: questions, error, loading } = useAsyncResource(
    () => diagnosticApi.getQuestions(),
    []
  );

  if (loading) {
    return <PageState title="Building diagnostic" message="EduFX is preparing the 40-question placement check." />;
  }

  if (error) {
    return <PageState tone="error" title="Diagnostic could not load" message={error} />;
  }

  if (!questions?.length) {
    return <PageState tone="empty" title="No diagnostic questions found" message="Seed the backend question set and refresh this page." />;
  }

  return <DiagnosticScreen questions={questions} />;
}
