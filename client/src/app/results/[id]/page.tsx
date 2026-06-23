"use client";

import { use, useEffect, useState } from "react";

import { ResultsScreen } from "@/features/results/results-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { resultsApi } from "@/lib/api";
import type { SessionResults } from "@/types/contracts";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const { student } = useAuthGuard();
  const [results, setResults] = useState<SessionResults | null>(null);
  const [explanations, setExplanations] = useState<Array<{ attempt_id: number; explanation: string }>>([]);

  useEffect(() => {
    async function load() {
      if (!student) {
        return;
      }
      const sessionId = Number(resolved.id);
      setResults(await resultsApi.getSession(sessionId, student.student_id));
      setExplanations(await resultsApi.getExplanations(sessionId, student.student_id));
    }
    void load();
  }, [resolved.id, student]);

  if (!results) {
    return null;
  }

  return <ResultsScreen results={results} explanations={explanations} />;
}
