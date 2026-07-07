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
  private phoneSignal = 0;
  private phonePositiveRuns = 0;
  private phoneNegativeRuns = 0;

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
      focus_score: this.latestState.focusScore,
      sleeping: this.latestState.sleeping,
      other_voice: this.latestState.otherVoice,
      object_detected: this.latestState.objectDetected,
      // Consume (and reset) the latch so each snapshot reports "was the tab
      // hidden at any point since the previous snapshot" — a 2s switch between
      // snapshots is still recorded.
      tab_hidden: this.integrityMonitor.consumeHiddenSinceLast()
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

    // Object detection runs on its own slower cadence — unlike the old phone
    // classifier it does NOT require a detected face: a phone held where it
    // hides the face is exactly the case we most want to catch.
    if (quality.usable && Date.now() - this.lastObjectRunAt > OBJECT_INFERENCE_INTERVAL_MS) {
      try {
        this.latestObjects = await this.objectDetector.detect(this.video);
        this.latestPhone = this.stabilisePhone({
          detected: this.latestObjects.phoneDetected,
          confidence: this.latestObjects.phoneScore,
          rawScore: this.latestObjects.phoneScore
        });
        this.lastObjectRunAt = Date.now();
        this.detectorWarning = null;
      } catch (objectError) {
        this.detectorWarning =
          objectError instanceof Error ? objectError.message : "Object detection unavailable";
      }
    } else if (!quality.usable) {
      this.latestPhone = this.decayPhoneSignal();
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

  private stabilisePhone(prediction: PhoneSignal): PhoneSignal {
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
