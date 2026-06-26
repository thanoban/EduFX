"use client";

import { use } from "react";

import { PageState } from "@/components/ui/page-state";
import { StudyScreen } from "@/features/study/study-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { contentApi } from "@/lib/api";
import { useAsyncResource } from "@/lib/use-async-resource";

export default function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const { student, loading: authLoading } = useAuthGuard();
  const { data: content, error, loading } = useAsyncResource(async () => {
      if (!student) {
        return null;
      }
      return contentApi.getContent(Number(resolved.id), student.student_id);
    },
    [resolved.id, student?.student_id]
  );

  if (authLoading || loading) {
    return <PageState title="Opening study notes" message="EduFX is selecting level-aware content for this topic." />;
  }

  if (error) {
    return <PageState tone="error" title="Study content could not load" message={error} />;
  }

  if (!content) {
    return <PageState tone="empty" title="No study content found" message="Choose another topic from the dashboard." />;
  }

  return <StudyScreen content={content} />;
}
