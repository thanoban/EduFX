"use client";

import { use } from "react";

import { PageState } from "@/components/ui/page-state";
import { QuizScreen } from "@/features/quiz/quiz-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { quizApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const { student, loading: authLoading } = useAuthGuard();
  const { data: quiz, error, loading } = useAsyncResource(async () => {
      if (!student) {
        return null;
      }
      return quizApi.getQuiz(Number(resolved.id), student.student_id);
    },
    [resolved.id, student?.student_id]
  );

  if (authLoading || loading) {
    return <PageState title="Preparing quiz" message="EduFX is building the next question set." />;
  }

  if (error) {
    return <PageState tone="error" title="Quiz could not load" message={error} />;
  }

  if (!quiz) {
    return <PageState tone="empty" title="No quiz found" message="Return to the dashboard and choose a topic again." />;
  }

  return <QuizScreen quiz={quiz} />;
}
