export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

export const STORAGE_KEYS = {
  student: "edufx.mvc.student",
  token: "edufx.mvc.token",
  lastDiagnostic: "edufx.mvc.diagnostic",
  lastSession: "edufx.mvc.last-session"
} as const;
