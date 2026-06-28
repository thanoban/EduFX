"use client";

import {
  PHONE_MODEL_META_PATH,
  PHONE_MODEL_PATH,
  PHONE_PREPROCESSOR_PATH,
  PHONE_WASM_PATH
} from "@/lib/constants";

type PhoneModelConfig = { input_shape?: number[]; classes?: Record<string, number> };
type TfJsModule = typeof import("@tensorflow/tfjs");
type TfliteModule = typeof import("@tensorflow/tfjs-tflite");
type TFLiteModelLike = Awaited<ReturnType<TfliteModule["loadTFLiteModel"]>>;
type TensorLike = { data: () => PromiseLike<ArrayLike<number>>; dispose: () => void };

type PhonePreprocessorConfig = {
  size?: number;
  image_mean?: number[];
  image_std?: number[];
  rescale_factor?: number;
  class_names?: string[];
};

export type PhonePrediction = { detected: boolean; confidence: number; rawScore: number };

/** Real phone-in-frame detection via the bundled TFLite MobileNetV2 classifier. */
export class PhoneDetector {
  private model: TFLiteModelLike | null = null;
  private config: PhoneModelConfig | null = null;
  private preprocessor: PhonePreprocessorConfig | null = null;
  private tf: TfJsModule | null = null;
  private tflite: TfliteModule | null = null;
  private readonly threshold: number;
  private initialised = false;

  constructor(threshold = 0.5) {
    this.threshold = threshold;
  }

  async init() {
    if (this.initialised) {
      return;
    }
    const [tf, tflite] = await Promise.all([import("@tensorflow/tfjs"), import("@tensorflow/tfjs-tflite")]);
    this.tf = tf;
    this.tflite = tflite;
    const wasmAware = tflite as TfliteModule & { setWasmPath?: (path: string) => void };
    if (typeof wasmAware.setWasmPath === "function") {
      wasmAware.setWasmPath(PHONE_WASM_PATH);
    }
    const [config, preprocessor] = await Promise.all([
      fetch(PHONE_MODEL_META_PATH).then((response) => response.json()),
      fetch(PHONE_PREPROCESSOR_PATH).then((response) => response.json())
    ]);
    this.config = config as PhoneModelConfig;
    this.preprocessor = preprocessor as PhonePreprocessorConfig;
    this.model = await tflite.loadTFLiteModel(PHONE_MODEL_PATH);
    this.initialised = true;
  }

  async detect(video: HTMLVideoElement): Promise<PhonePrediction> {
    if (!this.initialised || !this.model || !this.preprocessor) {
      await this.init();
    }
    if (!this.model || !this.preprocessor || !this.tf) {
      return { detected: false, confidence: 0, rawScore: 0 };
    }
    const tf = this.tf;

    const size = this.preprocessor.size ?? this.config?.input_shape?.[0] ?? 224;

    const inputTensor = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(video);
      const resized = tf.image.resizeBilinear(pixels, [size, size]);
      const floatTensor = resized.toFloat();
      const rescaled = floatTensor.mul(this.preprocessor?.rescale_factor ?? 1 / 255);
      const mean = tf.tensor1d(this.preprocessor?.image_mean ?? [0, 0, 0]);
      const std = tf.tensor1d(this.preprocessor?.image_std ?? [1, 1, 1]);
      return rescaled.sub(mean).div(std).expandDims(0);
    });

    const output = this.model.predict(inputTensor as unknown as Parameters<TFLiteModelLike["predict"]>[0]);
    const predictionTensor = Array.isArray(output)
      ? (output[0] as TensorLike)
      : typeof output === "object" && output !== null && "data" in output
        ? (output as TensorLike)
        : (Object.values(output as Record<string, TensorLike>)[0] as TensorLike);
    const values = await predictionTensor.data();
    const rawScore = Number(values[0] ?? 0);

    inputTensor.dispose();
    if (Array.isArray(output)) {
      output.forEach((tensor) => (tensor as TensorLike).dispose());
    } else if (typeof output === "object" && output !== null && "dispose" in output) {
      (output as TensorLike).dispose();
    } else {
      Object.values(output as Record<string, TensorLike>).forEach((tensor) => tensor.dispose());
    }

    const detected = rawScore >= this.threshold;
    const confidence = detected ? rawScore : 1 - rawScore;
    return { detected, confidence, rawScore };
  }
}
