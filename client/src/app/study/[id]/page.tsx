"use client";

import { use, useEffect, useState } from "react";

import { StudyScreen } from "@/features/study/study-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { contentApi } from "@/lib/api";
import type { ContentRecord } from "@/types/contracts";

export default function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const { student } = useAuthGuard();
  const [content, setContent] = useState<ContentRecord | null>(null);

  useEffect(() => {
    async function load() {
      if (!student) {
        return;
      }
      setContent(await contentApi.getContent(Number(resolved.id), student.student_id));
    }
    void load();
  }, [resolved.id, student]);

  if (!content) {
    return null;
  }

  return <StudyScreen content={content} />;
}
