"use client";

import { PageState } from "@/components/ui/page-state";
import { DiagnosticResultsScreen } from "@/features/diagnostic/diagnostic-results-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage } from "@/lib/storage";
import type { DiagnosticResult } from "@/types/contracts";

export default function DiagnosticResultsPage() {
  const { student, loading } = useAuthGuard();

  if (loading) {
    return (
      <PageState
        layout="auth"
        title="Loading diagnostic results"
        message="EduFX is restoring your placement results before opening the study map."
        eyebrow="Diagnostic"
      />
    );
  }

  if (!student) {
    return null;
  }

  const results = readStorage<DiagnosticResult[]>(STORAGE_KEYS.lastDiagnostic, []);
  return <DiagnosticResultsScreen results={results} />;
}
