"use client";

import type { BehaviourSnapshotPayload, BehaviourSummaryPayload } from "@/types/contracts";
import {
  FaceTracker,
  type FaceAnalysis,
  type FaceMetrics
} from "@/features/webcam/face-tracker";
import { FrameQualityAnalyzer, type FrameQuality } from "@/features/webcam/frame-quality";
import { PhoneDetector, type PhonePrediction } from "@/features/webcam/phone-detector";

const LIVE_SAMPLE_INTERVAL_MS = 250;
const PHONE_INFERENCE_INTERVAL_MS = 1_000;
const PHONE_SIGNAL_ALPHA = 0.45;
const PHONE_ON_THRESHOLD = 0.58;
const PHONE_OFF_THRESHOLD = 0.45;

const EMPTY_METRICS: FaceMetrics = {
  ear: 0,
  mar: 0,
  yaw: 0,
  pitch: 0,
  eyeClosure: 0,
  mouthOpen: 0,
  centerOffsetX: 0,
  centerOffsetY: 0
};

const EMPTY_QUALITY: FrameQuality = {
  brightness: 1,
  sharpness: 1,
  usable: true,
  warning: null
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  calibrated: boolean;
  calibrationProgress: number;
  quality: FrameQuality;
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
  faceMetrics: EMPTY_METRICS,
  calibrated: false,
  calibrationProgress: 0,
  quality: EMPTY_QUALITY,
  ready: false,
  warning: null
};

/**
 * Orchestrates the face landmarker + phone detector against a live <video>.
 * Adds frame-quality checks and hysteresis so the live focus state is less
 * reactive to single bad frames or shaky phone-model scores.
 */
export class BrowserBehaviourTracker {
  private readonly faceTracker = new FaceTracker();
  private readonly phoneDetector = new PhoneDetector();
  private readonly qualityAnalyzer = new FrameQualityAnalyzer();
  private readonly snapshots: BehaviourSnapshotPayload[] = [];
  private video: HTMLVideoElement | null = null;
  private timerId: number | null = null;
  private lastPhoneRunAt = 0;
  private latestPhone: PhonePrediction = { detected: false, confidence: 0, rawScore: 0 };
  private latestState: TrackerRealtimeState = { ...INITIAL_STATE };
  private studentId = 0;
  private sessionId = 0;
  private onUpdate?: (state: TrackerRealtimeState) => void;
  private detectorWarning: string | null = null;
  private phoneSignal = 0;
  private phonePositiveRuns = 0;
  private phoneNegativeRuns = 0;

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
      this.detectorWarning = null;
      this.latestState = { ...this.latestState, ready: true, warning: null };
    } catch (initialiseError) {
      this.latestState = {
        ...this.latestState,
        ready: false,
        warning:
          initialiseError instanceof Error
            ? initialiseError.message
            : "Unable to initialize webcam detectors"
      };
      this.onUpdate?.(this.latestState);
      return;
    }

    this.timerId = window.setInterval(() => {
      void this.sampleFrame();
    }, LIVE_SAMPLE_INTERVAL_MS);
    await this.sampleFrame();
  }

  stop() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.faceTracker.close();
    this.resetPhoneSignal();
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

    const quality = this.qualityAnalyzer.analyze(this.video);
    const face = await this.faceTracker.analyze(this.video);
    const gatedFace = this.applyQualityGate(face, quality);

    if (!gatedFace.face_detected) {
      this.resetPhoneSignal();
    } else if (quality.usable && Date.now() - this.lastPhoneRunAt > PHONE_INFERENCE_INTERVAL_MS) {
      try {
        const rawPhone = await this.phoneDetector.detect(this.video);
        this.latestPhone = this.stabilisePhone(rawPhone);
        this.lastPhoneRunAt = Date.now();
        this.detectorWarning = null;
      } catch (phoneError) {
        this.detectorWarning =
          phoneError instanceof Error ? phoneError.message : "Phone detection unavailable";
      }
    } else if (!quality.usable) {
      this.latestPhone = this.decayPhoneSignal();
    }

    const focusScore = computeFocusScore(
      this.latestPhone.detected,
      gatedFace.absent,
      gatedFace.drowsy,
      gatedFace.looking_away,
      gatedFace.multiple_persons,
      gatedFace.talking
    );

    this.latestState = {
      faceDetected: gatedFace.face_detected,
      lookingAway: gatedFace.looking_away,
      phoneDetected: this.latestPhone.detected,
      drowsy: gatedFace.drowsy,
      multiplePersons: gatedFace.multiple_persons,
      talking: gatedFace.talking,
      absent: gatedFace.absent,
      focusScore,
      phoneConfidence: this.latestPhone.confidence,
      faceMetrics: gatedFace.metrics,
      calibrated: gatedFace.calibrated,
      calibrationProgress: gatedFace.calibration_progress,
      quality,
      ready: true,
      warning: this.resolveWarning(quality, gatedFace)
    };
    this.onUpdate?.(this.latestState);
  }

  private applyQualityGate(face: FaceAnalysis, quality: FrameQuality): FaceAnalysis {
    if (quality.usable) {
      return face;
    }

    if (!face.face_detected) {
      return {
        ...face,
        absent: false
      };
    }

    return {
      ...face,
      drowsy: false,
      talking: false,
      looking_away: false,
      multiple_persons: false
    };
  }

  private resolveWarning(quality: FrameQuality, face: FaceAnalysis) {
    if (!quality.usable && quality.warning) {
      return quality.warning;
    }
    if (this.detectorWarning) {
      return this.detectorWarning;
    }
    if (face.face_detected && !face.calibrated) {
      return `Calibrating webcam tracking (${face.calibration_progress}%).`;
    }
    return null;
  }

  private stabilisePhone(prediction: PhonePrediction): PhonePrediction {
    this.phoneSignal =
      this.phoneSignal + (prediction.rawScore - this.phoneSignal) * PHONE_SIGNAL_ALPHA;

    if (this.phoneSignal >= PHONE_ON_THRESHOLD) {
      this.phonePositiveRuns += 1;
      this.phoneNegativeRuns = 0;
      if (this.phonePositiveRuns >= 2) {
        this.latestPhone.detected = true;
      }
    } else if (this.phoneSignal <= PHONE_OFF_THRESHOLD) {
      this.phonePositiveRuns = 0;
      this.phoneNegativeRuns += 1;
      if (this.phoneNegativeRuns >= 2) {
        this.latestPhone.detected = false;
      }
    }

    return {
      detected: this.latestPhone.detected,
      confidence: clamp(this.latestPhone.detected ? this.phoneSignal : 1 - this.phoneSignal, 0, 1),
      rawScore: clamp(this.phoneSignal, 0, 1)
    };
  }

  private decayPhoneSignal() {
    this.phoneSignal *= 0.7;
    if (this.phoneSignal <= PHONE_OFF_THRESHOLD) {
      this.phoneNegativeRuns += 1;
      this.phonePositiveRuns = 0;
      if (this.phoneNegativeRuns >= 2) {
        this.latestPhone.detected = false;
      }
    }

    return {
      detected: this.latestPhone.detected,
      confidence: clamp(this.latestPhone.detected ? this.phoneSignal : 1 - this.phoneSignal, 0, 1),
      rawScore: clamp(this.phoneSignal, 0, 1)
    };
  }

  private resetPhoneSignal() {
    this.phoneSignal = 0;
    this.phonePositiveRuns = 0;
    this.phoneNegativeRuns = 0;
    this.latestPhone = { detected: false, confidence: 0, rawScore: 0 };
  }
}
