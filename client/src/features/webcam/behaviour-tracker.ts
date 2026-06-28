"use client";

import type { BehaviourSnapshotPayload, BehaviourSummaryPayload } from "@/types/contracts";
import { FaceTracker, type FaceAnalysis } from "@/features/webcam/face-tracker";
import { PhoneDetector, type PhonePrediction } from "@/features/webcam/phone-detector";

/**
 * Focus score = 100 minus weighted penalties for each detected distraction.
 * Mirrors the server-side `calculate_focus_score` in app/core/rules.py so the
 * live UI number and the persisted snapshot agree.
 */
function computeFocusScore(
  phoneDetected: boolean,
  absent: boolean,
  drowsy: boolean,
  lookingAway: boolean,
  multiplePersons: boolean,
  talking: boolean
) {
  let score = 100;
  if (phoneDetected) score -= 40;
  if (absent) score -= 50;
  if (drowsy) score -= 30;
  if (lookingAway) score -= 20;
  if (multiplePersons) score -= 20;
  if (talking) score -= 10;
  return Math.max(0, score);
}

export type TrackerRealtimeState = {
  faceDetected: boolean;
  lookingAway: boolean;
  phoneDetected: boolean;
  drowsy: boolean;
  multiplePersons: boolean;
  talking: boolean;
  absent: boolean;
  focusScore: number;
  phoneConfidence: number;
  faceMetrics: FaceAnalysis["metrics"];
  ready: boolean;
  warning: string | null;
};

const INITIAL_STATE: TrackerRealtimeState = {
  faceDetected: false,
  lookingAway: false,
  phoneDetected: false,
  drowsy: false,
  multiplePersons: false,
  talking: false,
  absent: false,
  focusScore: 100,
  phoneConfidence: 0,
  faceMetrics: { ear: 0, mar: 0, yaw: 0, pitch: 0 },
  ready: false,
  warning: null
};

/**
 * Orchestrates the face landmarker + phone detector against a live <video>.
 * Samples frames every 300ms for the live state and persists a snapshot only
 * when `takeSnapshot()` is called (the hook does this on a slower cadence).
 */
export class BrowserBehaviourTracker {
  private readonly faceTracker = new FaceTracker();
  private readonly phoneDetector = new PhoneDetector();
  private readonly snapshots: BehaviourSnapshotPayload[] = [];
  private video: HTMLVideoElement | null = null;
  private timerId: number | null = null;
  private lastPhoneRunAt = 0;
  private latestPhone: PhonePrediction = { detected: false, confidence: 0, rawScore: 0 };
  private latestState: TrackerRealtimeState = { ...INITIAL_STATE };
  private studentId = 0;
  private sessionId = 0;
  private onUpdate?: (state: TrackerRealtimeState) => void;

  async start(
    video: HTMLVideoElement,
    studentId: number,
    sessionId: number,
    onUpdate?: (state: TrackerRealtimeState) => void
  ) {
    this.video = video;
    this.studentId = studentId;
    this.sessionId = sessionId;
    this.onUpdate = onUpdate;

    try {
      await Promise.all([this.faceTracker.init(), this.phoneDetector.init()]);
      this.latestState = { ...this.latestState, ready: true, warning: null };
    } catch (initialiseError) {
      this.latestState = {
        ...this.latestState,
        ready: false,
        warning: initialiseError instanceof Error ? initialiseError.message : "Unable to initialize webcam detectors"
      };
      this.onUpdate?.(this.latestState);
      return;
    }

    this.timerId = window.setInterval(() => {
      void this.sampleFrame();
    }, 300);
    await this.sampleFrame();
  }

  stop() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.faceTracker.close();
  }

  getState() {
    return this.latestState;
  }

  takeSnapshot(): BehaviourSnapshotPayload {
    const snapshot: BehaviourSnapshotPayload = {
      student_id: this.studentId,
      session_id: this.sessionId,
      face_detected: this.latestState.faceDetected,
      looking_away: this.latestState.lookingAway,
      phone_detected: this.latestState.phoneDetected,
      drowsy: this.latestState.drowsy,
      multiple_persons: this.latestState.multiplePersons,
      talking: this.latestState.talking,
      absent: this.latestState.absent,
      focus_score: this.latestState.focusScore
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  hasSnapshots() {
    return this.snapshots.length > 0;
  }

  buildSummary(subtopicId: number, webcamEnabled: boolean): BehaviourSummaryPayload {
    const snapshots = this.snapshots.length ? this.snapshots : [this.takeSnapshot()];
    const percentage = (key: keyof BehaviourSnapshotPayload) => {
      const total = snapshots.length || 1;
      const hits = snapshots.filter((snapshot) => Boolean(snapshot[key])).length;
      return Math.round((hits / total) * 100);
    };
    const focused = snapshots.filter((snapshot) => snapshot.focus_score >= 80).length;

    return {
      student_id: this.studentId,
      session_id: this.sessionId,
      subtopic_id: subtopicId,
      webcam_enabled: webcamEnabled,
      phone_percent: percentage("phone_detected"),
      drowsy_percent: percentage("drowsy"),
      away_percent: percentage("looking_away"),
      talking_percent: percentage("talking"),
      absent_percent: percentage("absent"),
      focus_score: Math.round((focused / (snapshots.length || 1)) * 100)
    };
  }

  private async sampleFrame() {
    if (!this.video || this.video.readyState < 2) {
      return;
    }

    const face = await this.faceTracker.analyze(this.video);

    if (Date.now() - this.lastPhoneRunAt > 1500 && face.face_detected) {
      try {
        this.latestPhone = await this.phoneDetector.detect(this.video);
        this.lastPhoneRunAt = Date.now();
      } catch (phoneError) {
        this.latestState = {
          ...this.latestState,
          warning: phoneError instanceof Error ? phoneError.message : "Phone detection unavailable"
        };
      }
    }

    const focusScore = computeFocusScore(
      this.latestPhone.detected,
      face.absent,
      face.drowsy,
      face.looking_away,
      face.multiple_persons,
      face.talking
    );

    this.latestState = {
      faceDetected: face.face_detected,
      lookingAway: face.looking_away,
      phoneDetected: this.latestPhone.detected,
      drowsy: face.drowsy,
      multiplePersons: face.multiple_persons,
      talking: face.talking,
      absent: face.absent,
      focusScore,
      phoneConfidence: this.latestPhone.confidence,
      faceMetrics: face.metrics,
      ready: true,
      warning: this.latestState.warning
    };
    this.onUpdate?.(this.latestState);
  }
}
