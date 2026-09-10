"use client";

/**
 * Real object detection via TensorFlow.js COCO-SSD (lite MobileNet v2).
 *
 * Replaces the old whole-frame "does this look phone-ish" classifier. COCO-SSD
 * *localizes* objects with bounding boxes + confidence, so instead of a single
 * fuzzy score we get concrete detections of a phone, a book/notes, a second
 * device, and a head-count of people — all from one pass. Runs fully in the
 * browser (model streams from Google's CDN, like MediaPipe), no backend.
 */

type CocoModule = typeof import("@tensorflow-models/coco-ssd");
type CocoModel = Awaited<ReturnType<CocoModule["load"]>>;

// COCO class names we care about for proctoring.
const PHONE_CLASS = "cell phone";
const PERSON_CLASS = "person";
// A book/laptop/second screen in frame is a strong "notes/second device" signal.
const OBJECT_CLASSES = new Set(["book", "laptop", "tv", "remote", "keyboard"]);

// Per-class confidence floors. A phone in the hand at webcam angle is small,
// tilted, and half-covered by fingers — COCO-SSD commonly scores it 0.3-0.5,
// so the phone floor sits well below the others. The tracker's temporal latch
// (two weak hits or one strong hit) filters the false positives this lets in.
const PHONE_MIN_SCORE = 0.3;
const OBJECT_MIN_SCORE = 0.45;
const PERSON_MIN_SCORE = 0.5;

export type ObjectPrediction = {
  /** Highest cell-phone detection confidence in the frame (0 when none). */
  phoneScore: number;
  phoneDetected: boolean;
  /** A book / laptop / second screen was found in frame. */
  objectDetected: boolean;
  /** How many people COCO-SSD sees (>=0). */
  personCount: number;
};

const EMPTY: ObjectPrediction = {
  phoneScore: 0,
  phoneDetected: false,
  objectDetected: false,
  personCount: 0
};

// A handheld phone in a webcam frame is usually held around chest/lap height,
// not near the face — cropping to the lower portion of the frame and
// upscaling it into a square canvas makes a small, tilted phone occupy far
// more of the pixels the model actually sees, which is what COCO-SSD's
// input-resize step needs to have a real chance of finding it. This is the
// single biggest lever available without training a custom model.
const CROP_HEIGHT_FRACTION = 0.65;
const CROP_CANVAS_SIZE = 480;

export class ObjectDetector {
  private model: CocoModel | null = null;
  private initialised = false;
  private cropCanvas: HTMLCanvasElement | null = null;
  private cropContext: CanvasRenderingContext2D | null = null;

  async init() {
    if (this.initialised) {
      return;
    }
    // Importing tfjs registers a backend (WebGL, then CPU) that COCO-SSD needs.
    const [tf, cocoSsd] = await Promise.all([
      import("@tensorflow/tfjs"),
      import("@tensorflow-models/coco-ssd")
    ]);
    await tf.ready();
    // Full mobilenet_v2 base: noticeably better at small/angled objects (a phone
    // in the hand) than the lite base, and our ~1.2s inference cadence leaves
    // plenty of headroom for the extra compute.
    this.model = await cocoSsd.load({ base: "mobilenet_v2" });
    this.initialised = true;
  }

  private drawCrop(video: HTMLVideoElement): HTMLCanvasElement | null {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }
    if (!this.cropCanvas) {
      this.cropCanvas = document.createElement("canvas");
      this.cropCanvas.width = CROP_CANVAS_SIZE;
      this.cropCanvas.height = CROP_CANVAS_SIZE;
      this.cropContext = this.cropCanvas.getContext("2d");
    }
    const context = this.cropContext;
    if (!context) {
      return null;
    }
    const cropHeight = Math.round(height * CROP_HEIGHT_FRACTION);
    const cropTop = height - cropHeight;
    context.drawImage(
      video,
      0,
      cropTop,
      width,
      cropHeight,
      0,
      0,
      CROP_CANVAS_SIZE,
      CROP_CANVAS_SIZE
    );
    return this.cropCanvas;
  }

  private highestPhoneScore(predictions: Array<{ class: string; score: number }>): number {
    let best = 0;
    for (const prediction of predictions) {
      if (prediction.class === PHONE_CLASS) {
        best = Math.max(best, prediction.score);
      }
    }
    return best;
  }

  async detect(video: HTMLVideoElement): Promise<ObjectPrediction> {
    if (!this.initialised || !this.model) {
      await this.init();
    }
    if (!this.model) {
      return { ...EMPTY };
    }

    // maxNumBoxes kept modest — we only need a handful of high-confidence boxes.
    // The overall floor is the lowest per-class floor; classes filter themselves below.
    const predictions = await this.model.detect(video, 10, PHONE_MIN_SCORE);

    let phoneScore = 0;
    let objectDetected = false;
    let personCount = 0;

    for (const prediction of predictions) {
      if (prediction.class === PHONE_CLASS && prediction.score >= PHONE_MIN_SCORE) {
        phoneScore = Math.max(phoneScore, prediction.score);
      } else if (prediction.class === PERSON_CLASS && prediction.score >= PERSON_MIN_SCORE) {
        personCount += 1;
      } else if (OBJECT_CLASSES.has(prediction.class) && prediction.score >= OBJECT_MIN_SCORE) {
        objectDetected = true;
      }
    }

    // Second pass on the magnified lower-frame crop, phone score only — full
    // frame stays authoritative for person/object counts so a person visible
    // in both passes is never double-counted.
    const cropCanvas = this.drawCrop(video);
    if (cropCanvas) {
      try {
        const cropPredictions = await this.model.detect(cropCanvas, 5, PHONE_MIN_SCORE);
        phoneScore = Math.max(phoneScore, this.highestPhoneScore(cropPredictions));
      } catch {
        // Crop pass is a recall booster, not a requirement — full-frame result still stands.
      }
    }

    return {
      phoneScore,
      phoneDetected: phoneScore >= PHONE_MIN_SCORE,
      objectDetected,
      personCount
    };
  }
}
