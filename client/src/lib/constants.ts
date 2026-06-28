export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

// MediaPipe FaceLandmarker loads its model + wasm from the public CDN by default.
export const FACE_LANDMARKER_WASM_URL =
  process.env.NEXT_PUBLIC_FACE_LANDMARKER_WASM_URL ??
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export const FACE_LANDMARKER_MODEL_URL =
  process.env.NEXT_PUBLIC_FACE_LANDMARKER_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// TFLite phone-detection model is served from the local public folder.
export const PHONE_WASM_PATH = "/wasm/";
export const PHONE_MODEL_PATH = "/models/phone/phone_detection_model.tflite";
export const PHONE_MODEL_META_PATH = "/models/phone/model_config.json";
export const PHONE_PREPROCESSOR_PATH = "/models/phone/preprocessor_config.json";

export const STORAGE_KEYS = {
  student: "edufx.mvc.student",
  token: "edufx.mvc.token",
  lastDiagnostic: "edufx.mvc.diagnostic",
  lastSession: "edufx.mvc.last-session",
  lastQuizResult: "edufx.mvc.last-quiz-result"
} as const;
