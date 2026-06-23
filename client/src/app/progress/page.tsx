"use client";

import { useEffect, useState } from "react";

import { ProgressScreen } from "@/features/progress/progress-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { progressApi } from "@/lib/api";
import type { ProgressRecord } from "@/types/contracts";

export default function ProgressPage() {
  const { student } = useAuthGuard();
  const [progress, setProgress] = useState<ProgressRecord[]>([]);

  useEffect(() => {
    async function load() {
      if (!student) {
        return;
      }
      setProgress(await progressApi.getAll(student.student_id));
    }
    void load();
  }, [student]);

  return <ProgressScreen progress={progress} />;
}
