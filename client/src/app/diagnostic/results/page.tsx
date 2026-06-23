"use client";

import { DiagnosticResultsScreen } from "@/features/diagnostic/diagnostic-results-screen";
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage } from "@/lib/storage";
import type { DiagnosticResult } from "@/types/contracts";

export default function DiagnosticResultsPage() {
  const results = readStorage<DiagnosticResult[]>(STORAGE_KEYS.lastDiagnostic, []);
  return <DiagnosticResultsScreen results={results} />;
}
