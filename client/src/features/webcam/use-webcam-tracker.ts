"use client";

import { useCallback, useRef, useState } from "react";

import { behaviourApi } from "@/lib/api";
import {
  BrowserBehaviourTracker,
  type TrackerRealtimeState
} from "@/features/webcam/behaviour-tracker";

const SNAPSHOT_INTERVAL_MS = 12000;

/**
 * Drives the real MediaPipe + TFLite behaviour tracker for a quiz session.
 * Owns the camera stream and an offscreen <video>, persists a snapshot every
 * 12s, and exposes a live `state` for an on-screen focus indicator.
 */
export function useWebcamTracker() {
  const trackerRef = useRef<BrowserBehaviourTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<TrackerRealtimeState | null>(null);

  const releaseHardware = useCallback(() => {
    if (snapshotTimerRef.current) {
      window.clearInterval(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    trackerRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (studentId: number, sessionId: number, enabled: boolean) => {
      setState(null);
      if (!enabled || typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamRef.current = stream;

        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        videoRef.current = video;

        const tracker = new BrowserBehaviourTracker();
        trackerRef.current = tracker;
        await tracker.start(video, studentId, sessionId, setState);

        snapshotTimerRef.current = window.setInterval(() => {
          const snapshot = tracker.takeSnapshot();
          void behaviourApi.saveSnapshot(snapshot).catch(() => undefined);
        }, SNAPSHOT_INTERVAL_MS);
      } catch {
        // Camera denied or unavailable — degrade silently to an untracked session.
        releaseHardware();
      }
    },
    [releaseHardware]
  );

  const stop = useCallback(
    async (studentId: number, sessionId: number, subtopicId: number, enabled: boolean) => {
      const tracker = trackerRef.current;
      // Persist a final snapshot so very short sessions still have data to aggregate.
      if (tracker && enabled) {
        const snapshot = tracker.takeSnapshot();
        await behaviourApi.saveSnapshot(snapshot).catch(() => undefined);
      }
      releaseHardware();

      if (!enabled || !tracker) {
        return behaviourApi.saveSummary({
          student_id: studentId,
          session_id: sessionId,
          subtopic_id: subtopicId,
          webcam_enabled: enabled,
          phone_percent: 0,
          drowsy_percent: 0,
          away_percent: 0,
          talking_percent: 0,
          absent_percent: 0,
          focus_score: 0
        });
      }
      return behaviourApi.saveSummary(tracker.buildSummary(subtopicId, enabled));
    },
    [releaseHardware]
  );

  const cancel = useCallback(() => {
    releaseHardware();
    setState(null);
  }, [releaseHardware]);

  return { start, stop, cancel, state };
}
