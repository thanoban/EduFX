"use client";

export type FrameQuality = {
  brightness: number;
  sharpness: number;
  usable: boolean;
  warning: string | null;
};

const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 48;
const MIN_BRIGHTNESS = 0.16;
const MAX_BRIGHTNESS = 0.92;
const MIN_SHARPNESS = 0.045;

/**
 * Lightweight image-quality checks so the tracker can avoid overreacting when
 * the webcam frame is too dark, overexposed, or blurry for reliable signals.
 */
export class FrameQualityAnalyzer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;

  analyze(video: HTMLVideoElement): FrameQuality {
    if (typeof document === "undefined") {
      return { brightness: 1, sharpness: 1, usable: true, warning: null };
    }

    if (!this.canvas || !this.context) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = SAMPLE_WIDTH;
      this.canvas.height = SAMPLE_HEIGHT;
      this.context = this.canvas.getContext("2d", { willReadFrequently: true });
    }

    if (!this.context) {
      return { brightness: 1, sharpness: 1, usable: true, warning: null };
    }

    this.context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const frame = this.context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const grayscale = new Float32Array(SAMPLE_WIDTH * SAMPLE_HEIGHT);

    let brightnessSum = 0;
    for (let index = 0; index < grayscale.length; index += 1) {
      const pixelOffset = index * 4;
      const value =
        (frame.data[pixelOffset] * 0.299 +
          frame.data[pixelOffset + 1] * 0.587 +
          frame.data[pixelOffset + 2] * 0.114) /
        255;
      grayscale[index] = value;
      brightnessSum += value;
    }

    const brightness = brightnessSum / grayscale.length;

    let laplacianEnergy = 0;
    let laplacianSamples = 0;
    for (let y = 1; y < SAMPLE_HEIGHT - 1; y += 1) {
      for (let x = 1; x < SAMPLE_WIDTH - 1; x += 1) {
        const index = y * SAMPLE_WIDTH + x;
        const value = grayscale[index];
        const laplacian =
          4 * value -
          grayscale[index - 1] -
          grayscale[index + 1] -
          grayscale[index - SAMPLE_WIDTH] -
          grayscale[index + SAMPLE_WIDTH];
        laplacianEnergy += Math.abs(laplacian);
        laplacianSamples += 1;
      }
    }

    const sharpness = laplacianSamples ? laplacianEnergy / laplacianSamples : 0;

    let warning: string | null = null;
    if (brightness < MIN_BRIGHTNESS) {
      warning = "Low light is reducing webcam tracking accuracy.";
    } else if (brightness > MAX_BRIGHTNESS) {
      warning = "Camera exposure is too bright for stable tracking.";
    } else if (sharpness < MIN_SHARPNESS) {
      warning = "The webcam frame looks blurry, so EduFX is softening focus flags.";
    }

    return {
      brightness,
      sharpness,
      usable: warning === null,
      warning,
    };
  }
}
