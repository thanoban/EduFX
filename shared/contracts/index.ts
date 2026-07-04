export type Level = "beginner" | "intermediate" | "advanced";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

export type SessionLength = "short" | "medium" | "long";

export type StudentProfile = {
  student_id: number;
  name: string;
  email: string;
  diagnostic_completed: boolean;
  is_admin: boolean;
  free_days: number[];
  session_length: SessionLength;
  next_expected_date: string | null;
  email_reminders_enabled: boolean;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
};

export type UpdateAvailabilityPayload = {
  free_days: number[];
  session_length: SessionLength;
  email_reminders_enabled: boolean;
};

export type NextFreeChoice = "tomorrow" | "in_2_days" | "this_weekend" | "not_sure";

export type Subtopic = {
  id: number;
  title: string;
  group_name: string;
};

export type DiagnosticQuestion = {
  id: number;
  subtopic_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};

export type DiagnosticResult = {
  subtopic_id: number;
  subtopic_title: string;
  score_percent: number;
  assigned_level: Level;
};

export type StudyPlanItem = {
  subtopic_id: number;
  subtopic_title: string;
  group_name: string;
  current_level: Level;
  is_overdue: boolean;
  last_quiz_score: number;
  last_studied_date: string | null;
  type: "weak" | "strong";
};

export type ContentRecord = {
  id: number;
  subtopic_id: number;
  body: string;
  level: Level;
  subtopic_title: string;
  group_name: string;
};

export type QuizQuestion = {
  id: number;
  subtopic_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  difficulty: string;
  source: string;
  stage: string;
  student_id: number | null;
};

export type QuizPayload = {
  session_id: number;
  subtopic_id: number;
  subtopic_title: string;
  stage: string;
  total_questions: number;
  questions: QuizQuestion[];
};

export type QuizResultPayload = {
  session_id: number;
  total_questions: number;
  correct_answers: number;
  quiz_score: number;
  previous_level: Level;
  new_level: Level;
  level_changed: boolean;
  wrong_count: number;
};

export type BehaviourSnapshotPayload = {
  student_id: number;
  session_id: number;
  face_detected: boolean;
  looking_away: boolean;
  phone_detected: boolean;
  drowsy: boolean;
  multiple_persons: boolean;
  talking: boolean;
  absent: boolean;
  focus_score: number;
};

export type BehaviourSummaryPayload = {
  student_id: number;
  session_id: number;
  subtopic_id: number;
  webcam_enabled: boolean;
  phone_percent: number;
  drowsy_percent: number;
  away_percent: number;
  talking_percent: number;
  absent_percent: number;
  focus_score: number;
};

export type BehaviourSession = BehaviourSummaryPayload & {
  snapshots: Array<
    BehaviourSnapshotPayload & {
      id: number;
      timestamp: string;
    }
  >;
};

export type SessionAttempt = {
  id: number;
  question_id: number;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
  question: QuizQuestion;
};

export type SessionResults = {
  id: number;
  student_id: number;
  subtopic_id: number;
  quiz_score: number;
  focus_score: number | null;
  phone_percent: number;
  drowsy_percent: number;
  away_percent: number;
  talking_percent: number;
  absent_percent: number;
  webcam_enabled: boolean;
  total_questions: number;
  correct_answers: number;
  attempts: SessionAttempt[];
};

export type ProgressRecord = {
  id: number;
  subtopic_id: number;
  current_level: Level;
  last_studied_date: string | null;
  last_quiz_score: number;
  total_sessions: number;
  subtopics: Subtopic;
  session_history: Array<{
    id: number;
    session_date: string;
    quiz_score: number;
    focus_score: number | null;
    created_at: string;
  }>;
};

export type BehaviourHistoryItem = {
  id: number;
  student_id: number;
  subtopic_id: number;
  session_date: string;
  quiz_score: number;
  focus_score: number | null;
  phone_percent: number;
  drowsy_percent: number;
  away_percent: number;
  talking_percent: number;
  absent_percent: number;
  webcam_enabled: boolean;
  total_questions: number;
  correct_answers: number;
  created_at: string;
  subtopics: Subtopic | null;
};

export type StudentRole = "student" | "admin";

export type AdminStudentSummary = {
  student_id: number;
  name: string;
  email: string;
  role: StudentRole;
  diagnostic_completed: boolean;
  subtopics_mastered: number;
  avg_focus_score: number | null;
  total_sessions: number;
  last_active_date: string | null;
};

export type AdminWeakConcept = {
  concept: string;
  attempts: number;
  correct: number;
  accuracy: number;
  sample_question: string | null;
};

export type AdminSessionHistoryItem = {
  session_id: number;
  subtopic_id: number;
  subtopic_title: string;
  session_date: string;
  quiz_score: number;
  focus_score: number | null;
};

export type AdminStudentDetail = {
  student_id: number;
  name: string;
  email: string;
  role: StudentRole;
  diagnostic_completed: boolean;
  progress: ProgressRecord[];
  session_history: AdminSessionHistoryItem[];
  weak_concepts: AdminWeakConcept[];
};
