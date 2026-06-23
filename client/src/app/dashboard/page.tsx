"use client";

import { useEffect, useState } from "react";

import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { progressApi, schedulerApi } from "@/lib/api";
import type { ProgressRecord, StudyPlanItem } from "@/types/contracts";

export default function DashboardPage() {
  const { student } = useAuthGuard();
  const [plan, setPlan] = useState<StudyPlanItem[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);

  useEffect(() => {
    async function load() {
      if (!student) {
        return;
      }
      setPlan(await schedulerApi.getPlan(student.student_id));
      setProgress(await progressApi.getAll(student.student_id));
    }
    void load();
  }, [student]);

  return <DashboardScreen plan={plan} progress={progress} />;
}
