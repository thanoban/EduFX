"use client";

import { useEffect, useState } from "react";

import { DiagnosticScreen } from "@/features/diagnostic/diagnostic-screen";
import { diagnosticApi } from "@/lib/api";
import type { DiagnosticQuestion } from "@/types/contracts";

export default function DiagnosticPage() {
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);

  useEffect(() => {
    void diagnosticApi.getQuestions().then(setQuestions);
  }, []);

  if (!questions.length) {
    return null;
  }

  return <DiagnosticScreen questions={questions} />;
}
