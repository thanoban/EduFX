"use client";

import { use } from "react";

import { PageState } from "@/components/ui/page-state";
import { ResultsScreen } from "@/features/results/results-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { resultsApi } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage } from "@/lib/storage";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const { student, loading: authLoading } = useAuthGuard();
  const lastQuizResult = readStorage(STORAGE_KEYS.lastQuizResult, null);
  const { data, error, loading } = useAsyncResource(async () => {
      if (!student) {
        return null;
      }
      const sessionId = Number(resolved.id);
      const [results, explanations, coachPlan] = await Promise.all([
        resultsApi.getSession(sessionId, student.student_id),
        resultsApi.getExplanations(sessionId, student.student_id),
        resultsApi.getCoachPlan(sessionId, student.student_id)
      ]);
      return { results, explanations, coachPlan };
    },
    [resolved.id, student?.student_id]
  );

  if (authLoading || loading) {
    return (
      <PageState
        layout="workspace"
        title="Loading results"
        message="EduFX is preparing your score, focus, and explanations."
        eyebrow="Results"
      />
    );
  }

  if (error) {
    return <PageState tone="error" title="Results could not load" message={error} />;
  }

  if (!data?.results) {
    return <PageState tone="empty" title="No result session found" message="Complete a quiz to generate a result report." />;
  }

  return (
    <ResultsScreen
      results={data.results}
      explanations={data.explanations}
      coachPlan={data.coachPlan}
      lastQuizResult={lastQuizResult}
    />
  );
}
