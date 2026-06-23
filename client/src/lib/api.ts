import { API_BASE_URL } from "@/lib/constants";
import type {
  ApiResponse,
  BehaviourHistoryItem,
  BehaviourSession,
  BehaviourSnapshotPayload,
  BehaviourSummaryPayload,
  ContentRecord,
  DiagnosticQuestion,
  DiagnosticResult,
  ProgressRecord,
  QuizPayload,
  QuizResultPayload,
  SessionResults,
  StudentProfile,
  StudyPlanItem,
  Subtopic
} from "@/types/contracts";

type RequestOptions = {
  method?: "GET" | "POST";
  token?: string | null;
  studentId?: number;
  body?: unknown;
};

async function request<T>(
  path: string,
  { method = "GET", token, studentId, body }: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(studentId ? { "X-Student-Id": String(studentId) } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success || payload.data === null) {
    throw new Error(payload.message || `Request failed for ${path}`);
  }
  return payload.data;
}

export const authApi = {
  login(token: string) {
    return request<StudentProfile>("/auth/google", { method: "POST", token });
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
    }>(`/explanation/${sessionId}/${studentId}`);
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
