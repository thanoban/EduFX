"use client";

import { useEffect, useState } from "react";

import { BehaviourLogsScreen } from "@/features/behaviour/behaviour-logs-screen";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { behaviourApi } from "@/lib/api";
import type { BehaviourHistoryItem } from "@/types/contracts";

export default function BehaviourLogsPage() {
  const { student } = useAuthGuard();
  const [sessions, setSessions] = useState<BehaviourHistoryItem[]>([]);

  useEffect(() => {
    async function load() {
      if (!student) {
        return;
      }
      setSessions(await behaviourApi.getHistory(student.student_id));
    }
    void load();
  }, [student]);

  return <BehaviourLogsScreen sessions={sessions} />;
}
