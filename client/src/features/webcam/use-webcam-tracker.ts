"use client";

import { useCallback, useRef } from "react";

import { behaviourApi } from "@/lib/api";
import type { BehaviourSnapshotPayload, BehaviourSummaryPayload } from "@/types/contracts";

type Snapshot = BehaviourSnapshotPayload;

function createDemoSnapshot(studentId: number, sessionId: number): Snapshot {
  const phone = Math.random() > 0.9;
  const away = Math.random() > 0.82;
  const drowsy = Math.random() > 0.9;
  const talking = Math.random() > 0.88;
  const absent = Math.random() > 0.95;
  const multiple = Math.random() > 0.94;
  const focus = Math.max(
    100 -
      (phone ? 40 : 0) -
      (away ? 20 : 0) -
      (drowsy ? 30 : 0) -
      (talking ? 10 : 0) -
      (absent ? 50 : 0) -
      (multiple ? 20 : 0),
    0
  );
  return {
    student_id: studentId,
    session_id: sessionId,
    face_detected: !absent,
    looking_away: away,
    phone_detected: phone,
    drowsy,
    multiple_persons: multiple,
    talking,
    absent,
    focus_score: focus
  };
}

export function useWebcamTracker() {
  const intervalRef = useRef<number | null>(null);
  const snapshotsRef = useRef<Snapshot[]>([]);

  const start = useCallback((studentId: number, sessionId: number, enabled: boolean) => {
    snapshotsRef.current = [];
    if (!enabled || typeof window === "undefined") {
      return;
    }
    intervalRef.current = window.setInterval(async () => {
      const snapshot = createDemoSnapshot(studentId, sessionId);
      snapshotsRef.current.push(snapshot);
      await behaviourApi.saveSnapshot(snapshot);
    }, 12000);
  }, []);

  const stop = useCallback(
    async (studentId: number, sessionId: number, subtopicId: number, enabled: boolean) => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const snapshots = snapshotsRef.current;
      const total = snapshots.length || 1;
      const percent = (field: keyof Snapshot) =>
        Math.round((snapshots.filter((snapshot) => Boolean(snapshot[field])).length / total) * 100);
      const focus = snapshots.length
        ? Math.round(
            snapshots.reduce((sum, snapshot) => sum + snapshot.focus_score, 0) / snapshots.length
          )
        : enabled
          ? 100
          : 0;
      const summary: BehaviourSummaryPayload = {
        student_id: studentId,
        session_id: sessionId,
        subtopic_id: subtopicId,
        webcam_enabled: enabled,
        phone_percent: percent("phone_detected"),
        drowsy_percent: percent("drowsy"),
        away_percent: percent("looking_away"),
        talking_percent: percent("talking"),
        absent_percent: percent("absent"),
        focus_score: focus
      };
      return behaviourApi.saveSummary(summary);
    },
    []
  );

  const cancel = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { start, stop, cancel };
}
