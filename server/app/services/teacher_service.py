"""TeacherService — orchestrates the AI-teacher graph over a fresh dossier.

Read-only: builds the deterministic student dossier, runs the LangGraph teacher
graph, and returns text. It never mutates student data and never touches
scheduling. Both surfaces (chat, auto-report) go through here.
"""
from __future__ import annotations

from app.agents.dossier import StudentDossier, build_student_dossier, dossier_to_prompt_context
from app.agents.teacher_graph import get_teacher_graph
from app.ml.recommender_engine import RecommenderEngine
from app.models.dto import TeacherReplyDTO, TeacherReportDTO
from app.repositories.progress_repository import ProgressRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository

_NO_DATA_REPLY = (
    "I don't have any study data for you yet — complete a quiz or two and then "
    "I can tell you how you're doing and where to focus."
)


class TeacherService:
    def __init__(
        self,
        results_repository: ResultsRepository,
        progress_repository: ProgressRepository,
        scheduler_repository: SchedulerRepository,
        quiz_repository: QuizRepository,
        recommender_engine: RecommenderEngine,
    ) -> None:
        self.results_repository = results_repository
        self.progress_repository = progress_repository
        self.scheduler_repository = scheduler_repository
        self.quiz_repository = quiz_repository
        self.recommender_engine = recommender_engine

    def _dossier(self, student_id: int) -> StudentDossier | None:
        return build_student_dossier(
            student_id,
            results_repository=self.results_repository,
            progress_repository=self.progress_repository,
            scheduler_repository=self.scheduler_repository,
            quiz_repository=self.quiz_repository,
            recommender_engine=self.recommender_engine,
        )

    def chat(self, student_id: int, message: str, history: list[dict]) -> TeacherReplyDTO:
        dossier = self._dossier(student_id)
        if dossier is None or dossier.total_sessions == 0:
            return TeacherReplyDTO(reply=_NO_DATA_REPLY)
        history_text = "\n".join(
            f"{turn.get('role', 'student').capitalize()}: {turn.get('content', '')}" for turn in history
        )
        result = get_teacher_graph().invoke(
            {
                "context": dossier_to_prompt_context(dossier),
                "mode": "chat",
                "question": message,
                "history": history_text,
            }
        )
        reply = (result.get("answer") or "").strip()
        return TeacherReplyDTO(reply=reply or _NO_DATA_REPLY)

    def generate_report(self, student_id: int) -> TeacherReportDTO:
        dossier = self._dossier(student_id)
        if dossier is None or dossier.total_sessions == 0:
            return TeacherReportDTO(report=_NO_DATA_REPLY)
        result = get_teacher_graph().invoke(
            {
                "context": dossier_to_prompt_context(dossier),
                "mode": "report",
                "question": "",
                "history": "",
            }
        )
        report = (result.get("answer") or "").strip()
        return TeacherReportDTO(report=report or _NO_DATA_REPLY)
