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

type Landmark = { x: number; y: number; z: number };
type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, startTimeMs: number) => {
    faceLandmarks?: Landmark[][];
  };
  close: () => void;
};

export type FaceAnalysis = {
  face_detected: boolean;
  absent: boolean;
  drowsy: boolean;
  talking: boolean;
  looking_away: boolean;
  multiple_persons: boolean;
  metrics: { ear: number; mar: number; yaw: number; pitch: number };
};

const EMPTY_METRICS = { ear: 0, mar: 0, yaw: 0, pitch: 0 };

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(top: Landmark, bottom: Landmark, left: Landmark, right: Landmark) {
  const vertical = distance(top, bottom);
  const horizontal = distance(left, right) || 1;
  return vertical / horizontal;
}

/**
 * Real face analysis via MediaPipe FaceLandmarker.
 * Derives drowsiness (eye aspect ratio), talking (mouth aspect ratio),
 * looking away (head yaw/pitch), and multi-person presence from live frames.
 */
export class FaceTracker {
  private landmarker: FaceLandmarkerLike | null = null;
  private initialised = false;
  private lowEarFrames = 0;
  private lastFaceSeenAt = Date.now();

  async init() {
    if (this.initialised) {
      return;
    }
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL);
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    });
    this.initialised = true;
  }

  async analyze(video: HTMLVideoElement): Promise<FaceAnalysis> {
    if (!this.initialised || !this.landmarker) {
      await this.init();
    }
    if (!this.landmarker) {
      return { face_detected: false, absent: true, drowsy: false, talking: false, looking_away: false, multiple_persons: false, metrics: EMPTY_METRICS };
    }

    const result = this.landmarker.detectForVideo(video, performance.now());
    const faces = result.faceLandmarks ?? [];

    if (faces.length === 0) {
      const absent = Date.now() - this.lastFaceSeenAt >= 10_000;
      this.lowEarFrames = 0;
      return { face_detected: false, absent, drowsy: false, talking: false, looking_away: false, multiple_persons: false, metrics: EMPTY_METRICS };
    }

    this.lastFaceSeenAt = Date.now();
    const face = faces[0] as Landmark[];

    const leftEar = eyeAspectRatio(face[LEFT_EYE.top], face[LEFT_EYE.bottom], face[LEFT_EYE.left], face[LEFT_EYE.right]);
    const rightEar = eyeAspectRatio(face[RIGHT_EYE.top], face[RIGHT_EYE.bottom], face[RIGHT_EYE.left], face[RIGHT_EYE.right]);
    const ear = (leftEar + rightEar) / 2;

    if (ear < 0.23) {
      this.lowEarFrames += 1;
    } else {
      this.lowEarFrames = 0;
    }

    const mar = distance(face[MOUTH.top], face[MOUTH.bottom]) / (distance(face[MOUTH.left], face[MOUTH.right]) || 1);

    const faceWidth = distance(face[LEFT_FACE], face[RIGHT_FACE]) || 1;
    const faceHeight = distance(face[FOREHEAD], face[CHIN]) || 1;
    const centerX = (face[LEFT_FACE].x + face[RIGHT_FACE].x) / 2;
    const centerY = (face[FOREHEAD].y + face[CHIN].y) / 2;
    const yaw = (face[NOSE].x - centerX) / faceWidth;
    const pitch = (face[NOSE].y - centerY) / faceHeight;

    return {
      face_detected: true,
      absent: false,
      drowsy: this.lowEarFrames >= 20,
      talking: mar > 0.42,
      looking_away: Math.abs(yaw) > 0.16 || Math.abs(pitch) > 0.2,
      multiple_persons: faces.length > 1,
      metrics: { ear, mar, yaw, pitch }
    };
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.initialised = false;
  }
}
