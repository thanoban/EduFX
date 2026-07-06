"use client";

import { FACE_LANDMARKER_MODEL_URL, FACE_LANDMARKER_WASM_URL } from "@/lib/constants";

const LEFT_EYE = { top: 159, bottom: 145, left: 33, right: 133 };
const RIGHT_EYE = { top: 386, bottom: 374, left: 362, right: 263 };
const MOUTH = { top: 13, bottom: 14, left: 61, right: 291 };
const NOSE = 1;
const LEFT_FACE = 234;
const RIGHT_FACE = 454;
const FOREHEAD = 10;
const CHIN = 152;

const ABSENT_TIMEOUT_MS = 4_000;
const CALIBRATION_TARGET_FRAMES = 18;
const SMOOTHING_ALPHA = 0.35;
const BASELINE_ADAPT_ALPHA = 0.05;

type Landmark = { x: number; y: number; z: number };
type BlendshapeCategory = { categoryName?: string; score?: number };
type FaceBlendshapeResult = { categories?: BlendshapeCategory[] };
type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, startTimeMs: number) => {
    faceLandmarks?: Landmark[][];
    faceBlendshapes?: FaceBlendshapeResult[];
  };
  close: () => void;
};

export type FaceMetrics = {
  ear: number;
  mar: number;
  yaw: number;
  pitch: number;
  eyeClosure: number;
  mouthOpen: number;
  centerOffsetX: number;
  centerOffsetY: number;
};

export type FaceAnalysis = {
  face_detected: boolean;
  absent: boolean;
  drowsy: boolean;
  talking: boolean;
  looking_away: boolean;
  multiple_persons: boolean;
  calibrated: boolean;
  calibration_progress: number;
  metrics: FaceMetrics;
};

type FlagState = {
  active: boolean;
  positiveFrames: number;
  negativeFrames: number;
};

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

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(top: Landmark, bottom: Landmark, left: Landmark, right: Landmark) {
  const vertical = distance(top, bottom);
  const horizontal = distance(left, right) || 1;
  return vertical / horizontal;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function blendShapeScore(blendshapes: FaceBlendshapeResult | undefined, names: string[]) {
  const categories = blendshapes?.categories ?? [];
  const category = categories.find((item) => item.categoryName && names.includes(item.categoryName));
  return clamp(category?.score ?? 0, 0, 1);
}

function smoothMetrics(previous: FaceMetrics | null, next: FaceMetrics): FaceMetrics {
  if (!previous) {
    return next;
  }

  return {
    ear: previous.ear + (next.ear - previous.ear) * SMOOTHING_ALPHA,
    mar: previous.mar + (next.mar - previous.mar) * SMOOTHING_ALPHA,
    yaw: previous.yaw + (next.yaw - previous.yaw) * SMOOTHING_ALPHA,
    pitch: previous.pitch + (next.pitch - previous.pitch) * SMOOTHING_ALPHA,
    eyeClosure: previous.eyeClosure + (next.eyeClosure - previous.eyeClosure) * SMOOTHING_ALPHA,
    mouthOpen: previous.mouthOpen + (next.mouthOpen - previous.mouthOpen) * SMOOTHING_ALPHA,
    centerOffsetX:
      previous.centerOffsetX + (next.centerOffsetX - previous.centerOffsetX) * SMOOTHING_ALPHA,
    centerOffsetY:
      previous.centerOffsetY + (next.centerOffsetY - previous.centerOffsetY) * SMOOTHING_ALPHA
  };
}

function calibrateBaseline(
  current: FaceMetrics | null,
  sample: FaceMetrics,
  frames: number
): FaceMetrics {
  if (!current || frames <= 1) {
    return sample;
  }

  const weight = 1 / frames;
  return {
    ear: current.ear + (sample.ear - current.ear) * weight,
    mar: current.mar + (sample.mar - current.mar) * weight,
    yaw: current.yaw + (sample.yaw - current.yaw) * weight,
    pitch: current.pitch + (sample.pitch - current.pitch) * weight,
    eyeClosure: current.eyeClosure + (sample.eyeClosure - current.eyeClosure) * weight,
    mouthOpen: current.mouthOpen + (sample.mouthOpen - current.mouthOpen) * weight,
    centerOffsetX: current.centerOffsetX + (sample.centerOffsetX - current.centerOffsetX) * weight,
    centerOffsetY: current.centerOffsetY + (sample.centerOffsetY - current.centerOffsetY) * weight
  };
}

function adaptBaseline(current: FaceMetrics | null, sample: FaceMetrics) {
  if (!current) {
    return sample;
  }

  return {
    ear: current.ear + (sample.ear - current.ear) * BASELINE_ADAPT_ALPHA,
    mar: current.mar + (sample.mar - current.mar) * BASELINE_ADAPT_ALPHA,
    yaw: current.yaw + (sample.yaw - current.yaw) * BASELINE_ADAPT_ALPHA,
    pitch: current.pitch + (sample.pitch - current.pitch) * BASELINE_ADAPT_ALPHA,
    eyeClosure: current.eyeClosure + (sample.eyeClosure - current.eyeClosure) * BASELINE_ADAPT_ALPHA,
    mouthOpen: current.mouthOpen + (sample.mouthOpen - current.mouthOpen) * BASELINE_ADAPT_ALPHA,
    centerOffsetX:
      current.centerOffsetX + (sample.centerOffsetX - current.centerOffsetX) * BASELINE_ADAPT_ALPHA,
    centerOffsetY:
      current.centerOffsetY + (sample.centerOffsetY - current.centerOffsetY) * BASELINE_ADAPT_ALPHA
  };
}

/**
 * Real face analysis via MediaPipe FaceLandmarker.
 * Uses landmark ratios, face blendshapes, calibration, and temporal smoothing
 * to reduce the noisy one-frame spikes that made webcam tracking feel brittle.
 */
export class FaceTracker {
  private landmarker: FaceLandmarkerLike | null = null;
  private initialised = false;
  private lastFaceSeenAt = Date.now();
  private smoothedMetrics: FaceMetrics | null = null;
  private baselineMetrics: FaceMetrics | null = null;
  private calibrationFrames = 0;
  private drowsyFlag: FlagState = { active: false, positiveFrames: 0, negativeFrames: 0 };
  private talkingFlag: FlagState = { active: false, positiveFrames: 0, negativeFrames: 0 };
  private awayFlag: FlagState = { active: false, positiveFrames: 0, negativeFrames: 0 };
  private multiFaceFlag: FlagState = { active: false, positiveFrames: 0, negativeFrames: 0 };

  async init() {
    if (this.initialised) {
      return;
    }

    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL);
    const commonOptions = {
      runningMode: "VIDEO" as const,
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.6,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false
    };

    try {
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: "GPU" },
        ...commonOptions
      });
    } catch {
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: "CPU" },
        ...commonOptions
      });
    }

    this.initialised = true;
  }

  async analyze(video: HTMLVideoElement): Promise<FaceAnalysis> {
    if (!this.initialised || !this.landmarker) {
      await this.init();
    }
    if (!this.landmarker) {
      return this.emptyAnalysis(true);
    }

    const result = this.landmarker.detectForVideo(video, performance.now());
    const faces = result.faceLandmarks ?? [];
    const blendshapes = result.faceBlendshapes ?? [];

    if (faces.length === 0) {
      return this.handleNoFace();
    }

    this.lastFaceSeenAt = Date.now();
    const metrics = this.extractMetrics(faces[0] as Landmark[], blendshapes[0]);
    this.smoothedMetrics = smoothMetrics(this.smoothedMetrics, metrics);
    const signal = this.smoothedMetrics;
    const multiplePersons = this.updateFlag("multiFaceFlag", faces.length > 1, 2, 2);
    const canCalibrate = faces.length === 1 && this.isStableCalibrationSample(signal);

    if (canCalibrate && this.calibrationFrames < CALIBRATION_TARGET_FRAMES) {
      this.calibrationFrames += 1;
      this.baselineMetrics = calibrateBaseline(
        this.baselineMetrics,
        signal,
        this.calibrationFrames
      );
    }

    const calibrated = this.calibrationFrames >= CALIBRATION_TARGET_FRAMES && !!this.baselineMetrics;
    const baseline = this.baselineMetrics ?? signal;

    const drowsyRaw =
      signal.ear < Math.max(0.16, baseline.ear * 0.74) ||
      signal.eyeClosure > Math.max(0.48, baseline.eyeClosure + 0.2);
    const talkingRaw =
      signal.mar > Math.max(0.34, baseline.mar + 0.09) ||
      signal.mouthOpen > Math.max(0.33, baseline.mouthOpen + 0.15);
    const lookingAwayRaw =
      Math.abs(signal.yaw - baseline.yaw) > Math.max(0.12, Math.abs(baseline.yaw) + 0.05) ||
      Math.abs(signal.pitch - baseline.pitch) > Math.max(0.15, Math.abs(baseline.pitch) + 0.07) ||
      Math.abs(signal.centerOffsetX - baseline.centerOffsetX) > 0.12 ||
      Math.abs(signal.centerOffsetY - baseline.centerOffsetY) > 0.16;

    const drowsy = this.updateFlag("drowsyFlag", drowsyRaw, 4, 2);
    const talking = this.updateFlag("talkingFlag", talkingRaw, 3, 3);
    const lookingAway = this.updateFlag("awayFlag", lookingAwayRaw, 3, 2);

    if (calibrated && !multiplePersons && !drowsy && !talking && !lookingAway) {
      this.baselineMetrics = adaptBaseline(this.baselineMetrics, signal);
    }

    return {
      face_detected: true,
      absent: false,
      drowsy,
      talking,
      looking_away: lookingAway,
      multiple_persons: multiplePersons,
      calibrated,
      calibration_progress: Math.round(
        (Math.min(this.calibrationFrames, CALIBRATION_TARGET_FRAMES) / CALIBRATION_TARGET_FRAMES) * 100
      ),
      metrics: signal
    };
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.initialised = false;
    this.smoothedMetrics = null;
    this.baselineMetrics = null;
    this.calibrationFrames = 0;
    this.drowsyFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
    this.talkingFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
    this.awayFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
    this.multiFaceFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
  }

  private handleNoFace(): FaceAnalysis {
    const absent = Date.now() - this.lastFaceSeenAt >= ABSENT_TIMEOUT_MS;
    this.smoothedMetrics = null;
    this.drowsyFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
    this.talkingFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
    this.awayFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };
    this.multiFaceFlag = { active: false, positiveFrames: 0, negativeFrames: 0 };

    return {
      face_detected: false,
      absent,
      drowsy: false,
      talking: false,
      looking_away: false,
      multiple_persons: false,
      calibrated: this.calibrationFrames >= CALIBRATION_TARGET_FRAMES,
      calibration_progress: Math.round(
        (Math.min(this.calibrationFrames, CALIBRATION_TARGET_FRAMES) / CALIBRATION_TARGET_FRAMES) * 100
      ),
      metrics: EMPTY_METRICS
    };
  }

  private emptyAnalysis(absent: boolean): FaceAnalysis {
    return {
      face_detected: false,
      absent,
      drowsy: false,
      talking: false,
      looking_away: false,
      multiple_persons: false,
      calibrated: false,
      calibration_progress: 0,
      metrics: EMPTY_METRICS
    };
  }

  private extractMetrics(face: Landmark[], blendshapes: FaceBlendshapeResult | undefined): FaceMetrics {
    const leftEar = eyeAspectRatio(
      face[LEFT_EYE.top],
      face[LEFT_EYE.bottom],
      face[LEFT_EYE.left],
      face[LEFT_EYE.right]
    );
    const rightEar = eyeAspectRatio(
      face[RIGHT_EYE.top],
      face[RIGHT_EYE.bottom],
      face[RIGHT_EYE.left],
      face[RIGHT_EYE.right]
    );
    const ear = (leftEar + rightEar) / 2;
    const mar =
      distance(face[MOUTH.top], face[MOUTH.bottom]) /
      (distance(face[MOUTH.left], face[MOUTH.right]) || 1);

    const faceWidth = distance(face[LEFT_FACE], face[RIGHT_FACE]) || 1;
    const faceHeight = distance(face[FOREHEAD], face[CHIN]) || 1;
    const centerX = (face[LEFT_FACE].x + face[RIGHT_FACE].x) / 2;
    const centerY = (face[FOREHEAD].y + face[CHIN].y) / 2;

    return {
      ear,
      mar,
      yaw: (face[NOSE].x - centerX) / faceWidth,
      pitch: (face[NOSE].y - centerY) / faceHeight,
      eyeClosure:
        (blendShapeScore(blendshapes, ["eyeBlinkLeft"]) +
          blendShapeScore(blendshapes, ["eyeBlinkRight"])) /
        2,
      mouthOpen: Math.max(
        blendShapeScore(blendshapes, ["jawOpen"]),
        blendShapeScore(blendshapes, ["mouthOpen"])
      ),
      centerOffsetX: centerX - 0.5,
      centerOffsetY: centerY - 0.5
    };
  }

  private isStableCalibrationSample(metrics: FaceMetrics) {
    return (
      metrics.ear > 0.18 &&
      metrics.eyeClosure < 0.5 &&
      metrics.mar < 0.55 &&
      metrics.mouthOpen < 0.5 &&
      Math.abs(metrics.centerOffsetX) < 0.18 &&
      Math.abs(metrics.centerOffsetY) < 0.2
    );
  }

  private updateFlag(
    field: "drowsyFlag" | "talkingFlag" | "awayFlag" | "multiFaceFlag",
    detected: boolean,
    activateAfter: number,
    releaseAfter: number
  ) {
    const flag = this[field];

    if (detected) {
      flag.positiveFrames += 1;
      flag.negativeFrames = 0;
      if (flag.positiveFrames >= activateAfter) {
        flag.active = true;
      }
    } else {
      flag.positiveFrames = 0;
      flag.negativeFrames += 1;
      if (flag.negativeFrames >= releaseAfter) {
        flag.active = false;
      }
    }

    this[field] = flag;
    return flag.active;
  }
}
