import { API_BASE_URL } from "@/lib/constants";
import type {
  AdminStudentDetail,
  AdminStudentSummary,
  ApiResponse,
  BehaviourHistoryItem,
  BehaviourSession,
  BehaviourSnapshotPayload,
  BehaviourSummaryPayload,
  ContentRecord,
  DiagnosticQuestion,
  DiagnosticResult,
  NextFreeChoice,
  ProgressRecord,
  QuizPayload,
  QuizResultPayload,
  SessionResults,
  StudentProfile,
  StudentRole,
  StudyPlanItem,
  Subtopic,
  UpdateAvailabilityPayload
} from "@/types/contracts";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  token?: string | null;
  studentId?: number;
  body?: unknown;
  timeoutMs?: number;
};

const REQUEST_RETRY_DELAYS_MS = [700, 1400, 2200];
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 15000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiErrorMessage(path: string, response: Response, payload: ApiResponse<unknown> | null, raw: string) {
  if (payload?.message) {
    return payload.message;
  }

  if (raw.trim()) {
    return raw.trim().slice(0, 220);
  }

  return `Request failed for ${path} (${response.status})`;
}

async function request<T>(
  path: string,
  { method = "GET", token, studentId, body, timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions = {}
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(studentId ? { "X-Student-Id": String(studentId) } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  };

  // Cloud Run scales to zero, so the first request after idle can be a cold
  // start that drops the connection (surfaces as "Failed to fetch" in the
  // browser). Retry transient network errors a few times with a short backoff
  // before giving up, so a cold backend doesn't break sign-in.
  let response: Response | null = null;
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt < REQUEST_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
      });

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < REQUEST_RETRY_DELAYS_MS.length - 1) {
        await delay(REQUEST_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < REQUEST_RETRY_DELAYS_MS.length - 1) {
        await delay(REQUEST_RETRY_DELAYS_MS[attempt]);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  if (!response) {
    const aborted =
      lastNetworkError instanceof DOMException
        ? lastNetworkError.name === "AbortError"
        : lastNetworkError instanceof Error && lastNetworkError.name === "AbortError";
    if (aborted) {
      throw new Error("EduFX took too long to respond. Please try again.");
    }

    throw new Error(
      lastNetworkError instanceof Error
        ? `Could not reach the EduFX server (${lastNetworkError.message}). Please try again.`
        : "Could not reach the EduFX server. Please try again."
    );
  }

  const raw = await response.text();
  let payload: ApiResponse<T> | null = null;
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw) as ApiResponse<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(path, response, payload, raw));
  }

  if (!payload || !payload.success || payload.data === null) {
    throw new Error(payload?.message || `Request failed for ${path}`);
  }
  return payload.data;
}

export const authApi = {
  login(token: string) {
    return request<StudentProfile>("/auth/google", { method: "POST", token, body: {} });
  },
  check(studentId: number) {
    return request<{ student_id: number; diagnostic_completed: boolean }>("/auth/check", {
      studentId
    });
  }
};

export const diagnosticApi = {
  async getQuestions() {
    const data = await request<{ total_questions: number; questions: DiagnosticQuestion[] }>(
      "/diagnostic/questions"
    );
    return data.questions;
  },
  submit(studentId: number, answers: Array<{ question_id: number; subtopic_id: number; student_answer: string }>) {
    return request<{ results: DiagnosticResult[] }>("/diagnostic/submit", {
      method: "POST",
      body: { student_id: studentId, answers }
    });
  }
};

export const schedulerApi = {
  async getPlan(studentId: number) {
    const data = await request<{ plan: StudyPlanItem[] }>(`/scheduler/todays-plan/${studentId}`);
    return data.plan;
  }
};

export const contentApi = {
  getSubtopics() {
    return request<Subtopic[]>("/content/subtopics");
  },
  getContent(subtopicId: number, studentId: number) {
    return request<ContentRecord>(`/content/${subtopicId}/${studentId}`);
  }
};

export const quizApi = {
  getQuiz(subtopicId: number, studentId: number) {
    return request<QuizPayload>(`/quiz/${subtopicId}/${studentId}`);
  },
  generate(subtopicId: number, studentId: number) {
    return request<QuizPayload>("/quiz/generate", {
      method: "POST",
      body: { subtopic_id: subtopicId, student_id: studentId }
    });
  }
};

export const resultsApi = {
  submit(
    studentId: number,
    sessionId: number,
    subtopicId: number,
    webcamEnabled: boolean,
    answers: Array<{ question_id: number; student_answer: string }>
  ) {
    return request<QuizResultPayload>("/results/submit-quiz", {
      method: "POST",
      body: {
        student_id: studentId,
        session_id: sessionId,
        subtopic_id: subtopicId,
        webcam_enabled: webcamEnabled,
        answers
      }
    });
  },
  getSession(sessionId: number, studentId: number) {
    return request<SessionResults>(`/results/session/${sessionId}/${studentId}`);
  },
  async getExplanations(sessionId: number, studentId: number) {
    const data = await request<{
      session_id: number;
      explanations: Array<{ attempt_id: number; explanation: string }>;
    }>(`/explanation/${sessionId}/${studentId}`, { timeoutMs: 45000 });
    return data.explanations;
  }
};

export const progressApi = {
  async getAll(studentId: number) {
    const data = await request<{ student_id: number; progress: ProgressRecord[] }>(
      `/progress/${studentId}`
    );
    return data.progress;
  },
  getOne(studentId: number, subtopicId: number) {
    return request<ProgressRecord>(`/progress/${studentId}/${subtopicId}`);
  }
};

export const adminApi = {
  // Admin routes are gated server-side by a real bearer token (require_admin
  // in routes/admin.py), unlike most other routes here which just trust the
  // student_id path param — so these calls need the actual token, not just an id.
  listStudents(token: string) {
    return request<AdminStudentSummary[]>("/admin/students", { token });
  },
  getStudentDetail(token: string, studentId: number) {
    return request<AdminStudentDetail>(`/admin/students/${studentId}`, { token });
  },
  setStudentRole(token: string, studentId: number, role: StudentRole) {
    return request<AdminStudentDetail>(`/admin/students/${studentId}/role`, {
      method: "PATCH",
      token,
      body: { role }
    });
  }
};

export const settingsApi = {
  updateAvailability(studentId: number, payload: UpdateAvailabilityPayload) {
    return request<StudentProfile>(`/settings/${studentId}/availability`, {
      method: "PUT",
      body: payload
    });
  },
  checkInNextFree(studentId: number, choice: NextFreeChoice) {
    return request<StudentProfile>(`/settings/${studentId}/next-free`, {
      method: "POST",
      body: { choice }
    });
  }
};

export const behaviourApi = {
  saveSnapshot(payload: BehaviourSnapshotPayload) {
    return request<{ snapshot_id: number; focus_score: number }>("/behaviour/save-snapshot", {
      method: "POST",
      body: payload
    });
  },
  saveSummary(payload: BehaviourSummaryPayload) {
    return request<{ session_id: number; focus_score: number | null }>("/behaviour/save-summary", {
      method: "POST",
      body: payload
    });
  },
  getSession(sessionId: number) {
    return request<BehaviourSession>(`/behaviour/session/${sessionId}`);
  },
  async getHistory(studentId: number) {
    const data = await request<{ student_id: number; sessions: BehaviourHistoryItem[] }>(
      `/behaviour/student/${studentId}`
    );
    return data.sessions;
  }
};
