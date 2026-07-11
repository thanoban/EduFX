"use client";

import type { BehaviourSnapshotPayload, BehaviourSummaryPayload } from "@/types/contracts";
import { AudioMonitor, type AudioState } from "@/features/webcam/audio-monitor";
import {
  FaceTracker,
  type FaceAnalysis,
  type FaceMetrics
} from "@/features/webcam/face-tracker";
import { FrameQualityAnalyzer, type FrameQuality } from "@/features/webcam/frame-quality";
import { IntegrityMonitor } from "@/features/webcam/integrity-monitor";
import { ObjectDetector, type ObjectPrediction } from "@/features/webcam/object-detector";

const LIVE_SAMPLE_INTERVAL_MS = 250;
const OBJECT_INFERENCE_INTERVAL_MS = 1_200;
// Event-latch tuning for the sparse COCO-SSD phone signal. Object detections
// are intermittent (the phone tilts, fingers cover it), so instead of the old
// EMA hysteresis — which needed ~6 consecutive clean detections and therefore
// almost never latched — one confident hit or two weak hits close together
// arm the latch, and it stays armed for a hold window after the last hit.
const PHONE_STRONG_SCORE = 0.55;
const PHONE_WEAK_SCORE = 0.3;
const PHONE_PAIR_WINDOW_MS = 6_000;
const PHONE_HOLD_MS = 6_000;

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
function computeFocusScore(flags: {
  phoneDetected: boolean;
  absent: boolean;
  drowsy: boolean;
  sleeping: boolean;
  tabHidden: boolean;
  otherVoice: boolean;
  lookingAway: boolean;
  multiplePersons: boolean;
  objectDetected: boolean;
  talking: boolean;
}) {
  let score = 100;
  if (flags.absent) score -= 50;
  if (flags.sleeping) score -= 45;
  if (flags.tabHidden) score -= 45;
  if (flags.phoneDetected) score -= 40;
  if (flags.drowsy) score -= 30;
  if (flags.otherVoice) score -= 25;
  if (flags.lookingAway) score -= 20;
  if (flags.multiplePersons) score -= 20;
  if (flags.objectDetected) score -= 20;
  if (flags.talking) score -= 10;
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
  sleeping: boolean;
  multiplePersons: boolean;
  peopleCount: number;
  talking: boolean;
  otherVoice: boolean;
  objectDetected: boolean;
  tabHidden: boolean;
  audioAvailable: boolean;
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
  sleeping: false,
  multiplePersons: false,
  peopleCount: 0,
  talking: false,
  otherVoice: false,
  objectDetected: false,
  tabHidden: false,
  audioAvailable: false,
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

type PhoneSignal = { detected: boolean; confidence: number; rawScore: number };

/** Violation flags OR-accumulated between snapshots, so a brief event (a 5s
 * phone check, a nod-off) between the 12s snapshots is still recorded instead
 * of only whatever happened to be true at the snapshot instant. */
type WindowViolations = {
  phoneDetected: boolean;
  absent: boolean;
  drowsy: boolean;
  sleeping: boolean;
  otherVoice: boolean;
  lookingAway: boolean;
  multiplePersons: boolean;
  objectDetected: boolean;
  talking: boolean;
};

const EMPTY_VIOLATIONS: WindowViolations = {
  phoneDetected: false,
  absent: false,
  drowsy: false,
  sleeping: false,
  otherVoice: false,
  lookingAway: false,
  multiplePersons: false,
  objectDetected: false,
  talking: false
};

/**
 * Orchestrates all per-signal detectors against a live <video> + mic stream:
 * MediaPipe FaceLandmarker (pose/gaze/sleep), COCO-SSD (phone/objects/people),
 * Web Audio VAD (speech), and the deterministic tab/window integrity monitor.
 * Adds frame-quality checks and hysteresis so the live focus state is less
 * reactive to single bad frames or shaky model scores.
 */
export class BrowserBehaviourTracker {
  private readonly faceTracker = new FaceTracker();
  private readonly objectDetector = new ObjectDetector();
  private readonly audioMonitor = new AudioMonitor();
  private readonly integrityMonitor = new IntegrityMonitor();
  private readonly qualityAnalyzer = new FrameQualityAnalyzer();
  private readonly snapshots: BehaviourSnapshotPayload[] = [];
  private video: HTMLVideoElement | null = null;
  private timerId: number | null = null;
  private lastObjectRunAt = 0;
  private latestPhone: PhoneSignal = { detected: false, confidence: 0, rawScore: 0 };
  private latestObjects: ObjectPrediction = {
    phoneScore: 0,
    phoneDetected: false,
    objectDetected: false,
    personCount: 0
  };
  private latestAudio: AudioState = { available: false, speechActive: false, level: 0 };
  private latestState: TrackerRealtimeState = { ...INITIAL_STATE };
  private studentId = 0;
  private sessionId = 0;
  private onUpdate?: (state: TrackerRealtimeState) => void;
  private detectorWarning: string | null = null;
  private phoneActive = false;
  private phoneLatchedAt = 0;
  private lastWeakPhoneHitAt = 0;
  private windowViolations: WindowViolations = { ...EMPTY_VIOLATIONS };

  async start(
    video: HTMLVideoElement,
    studentId: number,
    sessionId: number,
    onUpdate?: (state: TrackerRealtimeState) => void,
    stream?: MediaStream | null
  ) {
    this.video = video;
    this.studentId = studentId;
    this.sessionId = sessionId;
    this.onUpdate = onUpdate;

    try {
      await Promise.all([this.faceTracker.init(), this.objectDetector.init()]);
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

    // Optional extras: mic VAD only if the stream carries an audio track, and
    // the tab/window integrity listener always (it has no hardware dependency).
    if (stream) {
      const audioReady = await this.audioMonitor.start(stream).catch(() => false);
      this.latestAudio = { available: audioReady, speechActive: false, level: 0 };
    }
    this.integrityMonitor.start();

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
    this.audioMonitor.stop();
    this.integrityMonitor.stop();
    this.resetPhoneSignal();
  }

  getState() {
    return this.latestState;
  }

  takeSnapshot(): BehaviourSnapshotPayload {
    // Consume (and reset) the accumulated window rather than reading the
    // instantaneous live state, so a violation that already cleared by the
    // snapshot instant (a 5s phone check, a short nod-off) is still recorded.
    const violations = this.windowViolations;
    this.windowViolations = { ...EMPTY_VIOLATIONS };
    const tabHidden = this.integrityMonitor.consumeHiddenSinceLast();

    const snapshot: BehaviourSnapshotPayload = {
      student_id: this.studentId,
      session_id: this.sessionId,
      face_detected: this.latestState.faceDetected,
      looking_away: violations.lookingAway,
      phone_detected: violations.phoneDetected,
      drowsy: violations.drowsy,
      multiple_persons: violations.multiplePersons,
      talking: violations.talking,
      absent: violations.absent,
      focus_score: computeFocusScore({ ...violations, tabHidden }),
      sleeping: violations.sleeping,
      other_voice: violations.otherVoice,
      object_detected: violations.objectDetected,
      tab_hidden: tabHidden
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
      sleeping_percent: percentage("sleeping"),
      other_voice_percent: percentage("other_voice"),
      object_percent: percentage("object_detected"),
      tab_switch_percent: percentage("tab_hidden"),
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

    // Object detection runs on its own slower cadence — unlike the old phone
    // classifier it does NOT require a detected face: a phone held where it
    // hides the face is exactly the case we most want to catch.
    if (quality.usable && Date.now() - this.lastObjectRunAt > OBJECT_INFERENCE_INTERVAL_MS) {
      try {
        this.latestObjects = await this.objectDetector.detect(this.video);
        this.latestPhone = this.updatePhoneLatch(this.latestObjects.phoneScore);
        this.lastObjectRunAt = Date.now();
        this.detectorWarning = null;
      } catch (objectError) {
        this.detectorWarning =
          objectError instanceof Error ? objectError.message : "Object detection unavailable";
      }
    } else {
      // No new inference this tick — just let the hold window expire naturally.
      this.latestPhone = this.expirePhoneLatch(this.latestPhone.rawScore);
    }

    this.latestAudio = this.audioMonitor.read();

    // Fuse people signals: the face mesh counts faces looking roughly at the
    // camera; COCO-SSD counts bodies. Either seeing >1 means someone else is there.
    const peopleCount = Math.max(
      gatedFace.people_count,
      quality.usable ? this.latestObjects.personCount : 0
    );
    const multiplePersons = gatedFace.multiple_persons || peopleCount > 1;

    // Fuse voice + mouth: speech with the student's mouth moving is the student
    // talking; speech while their mouth is still means another voice in the room.
    // Without a mic, fall back to the visual-only mouth signal.
    const speech = this.latestAudio.available && this.latestAudio.speechActive;
    const talking = this.latestAudio.available ? speech && gatedFace.talking : gatedFace.talking;
    const otherVoice = speech && !gatedFace.talking;

    const tabHidden = this.integrityMonitor.peekHidden();

    const flags = {
      phoneDetected: this.latestPhone.detected,
      absent: gatedFace.absent,
      drowsy: gatedFace.drowsy,
      sleeping: gatedFace.sleeping,
      tabHidden,
      otherVoice,
      lookingAway: gatedFace.looking_away,
      multiplePersons,
      objectDetected: quality.usable && this.latestObjects.objectDetected,
      talking
    };

    // OR every flag into the running window so a violation that fires and
    // clears between two 12s snapshots (a phone flash, a brief nod-off) still
    // gets recorded — takeSnapshot() consumes and resets this.
    this.windowViolations = {
      phoneDetected: this.windowViolations.phoneDetected || flags.phoneDetected,
      absent: this.windowViolations.absent || flags.absent,
      drowsy: this.windowViolations.drowsy || flags.drowsy,
      sleeping: this.windowViolations.sleeping || flags.sleeping,
      otherVoice: this.windowViolations.otherVoice || flags.otherVoice,
      lookingAway: this.windowViolations.lookingAway || flags.lookingAway,
      multiplePersons: this.windowViolations.multiplePersons || flags.multiplePersons,
      objectDetected: this.windowViolations.objectDetected || flags.objectDetected,
      talking: this.windowViolations.talking || flags.talking
    };

    this.latestState = {
      faceDetected: gatedFace.face_detected,
      lookingAway: flags.lookingAway,
      phoneDetected: flags.phoneDetected,
      drowsy: flags.drowsy,
      sleeping: flags.sleeping,
      multiplePersons: flags.multiplePersons,
      peopleCount,
      talking: flags.talking,
      otherVoice: flags.otherVoice,
      objectDetected: flags.objectDetected,
      tabHidden,
      audioAvailable: this.latestAudio.available,
      absent: flags.absent,
      focusScore: computeFocusScore(flags),
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
      sleeping: false,
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

  /** Feed one COCO-SSD phone score into the event latch (see constants above). */
  private updatePhoneLatch(score: number): PhoneSignal {
    const now = Date.now();
    if (score >= PHONE_STRONG_SCORE) {
      this.phoneActive = true;
      this.phoneLatchedAt = now;
    } else if (score >= PHONE_WEAK_SCORE) {
      // A weak hit confirms an already-armed latch, or pairs with another
      // recent weak hit — a single weak hit alone never fires.
      if (this.phoneActive || now - this.lastWeakPhoneHitAt <= PHONE_PAIR_WINDOW_MS) {
        this.phoneActive = true;
        this.phoneLatchedAt = now;
      }
      this.lastWeakPhoneHitAt = now;
    }
    return this.expirePhoneLatch(score);
  }

  /** Release the latch once the hold window passes with no new hit. */
  private expirePhoneLatch(score: number): PhoneSignal {
    if (this.phoneActive && Date.now() - this.phoneLatchedAt > PHONE_HOLD_MS) {
      this.phoneActive = false;
    }
    return {
      detected: this.phoneActive,
      confidence: clamp(this.phoneActive ? Math.max(score, PHONE_WEAK_SCORE) : 1 - score, 0, 1),
      rawScore: clamp(score, 0, 1)
    };
  }

  private resetPhoneSignal() {
    this.phoneActive = false;
    this.phoneLatchedAt = 0;
    this.lastWeakPhoneHitAt = 0;
    this.latestPhone = { detected: false, confidence: 0, rawScore: 0 };
  }
}
