"""LangGraph agent layer for EduFX.

Two agents, both read-only over the student's data and both driven by the shared
`app.services.ai_service` provider fallback (Gemini -> Groq -> Vertex):

- `teacher_graph` — the AI teacher: a supervisor graph (analyst / diagnostician /
  coach specialists + synthesis + a grounding guard) that answers a student's
  questions about their own performance and produces an auto-generated report.
  It NEVER touches scheduling — that stays the deterministic SchedulingAgent.
- `quiz_review` — a verify->fix reflection loop that checks LLM-generated quiz
  questions (is the marked answer actually correct? are the options valid?)
  before they reach a student.

`dossier.build_student_dossier` is the shared, deterministic, no-LLM data
assembly both the teacher chat and report run on.
"""
