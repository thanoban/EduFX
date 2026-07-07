"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { PageState } from "@/components/ui/page-state";
import { QuizScreen } from "@/features/quiz/quiz-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { quizApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const router = useRouter();
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
    return (
      <PageState
        layout="workspace"
        title="Preparing quiz"
        message="EduFX is building the next question set."
        eyebrow="Quiz"
      />
    );
  }

  if (error) {
    return (
      <PageState
        tone="error"
        title="Quiz could not load"
        message={error}
        actionLabel="Back to dashboard"
        onAction={() => router.push("/dashboard")}
      />
    );
  }

  if (!quiz) {
    return (
      <PageState
        tone="empty"
        title="No quiz found"
        message="Return to the dashboard to continue the active recommendation."
        actionLabel="Back to dashboard"
        onAction={() => router.push("/dashboard")}
      />
    );
  }

  return <QuizScreen quiz={quiz} />;
}
