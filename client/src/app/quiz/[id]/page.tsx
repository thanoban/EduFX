"use client";

import { use, useEffect, useState } from "react";

import { QuizScreen } from "@/features/quiz/quiz-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { quizApi } from "@/lib/api";
import type { QuizPayload } from "@/types/contracts";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const { student } = useAuthGuard();
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);

  useEffect(() => {
    async function load() {
      if (!student) {
        return;
      }
      setQuiz(await quizApi.getQuiz(Number(resolved.id), student.student_id));
    }
    void load();
  }, [resolved.id, student]);

  if (!quiz) {
    return null;
  }

  return <QuizScreen quiz={quiz} />;
}
