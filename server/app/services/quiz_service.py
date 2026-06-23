from __future__ import annotations

from datetime import UTC, datetime

from app.models.domain import Question
from app.models.dto import QuizPayloadDTO, QuizQuestionDTO
from app.repositories.contracts import ContentRepositoryContract, QuizRepositoryContract, ResultsRepositoryContract
from app.repositories.content_repository import ContentRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.rag_repository import RagRepository
from app.repositories.results_repository import ResultsRepository


class QuizService:
    def __init__(
        self,
        repository: QuizRepositoryContract | QuizRepository,
        content_repository: ContentRepositoryContract | ContentRepository,
        results_repository: ResultsRepositoryContract | ResultsRepository,
        rag_repository: RagRepository | None = None,
        vertex_model: str | None = None,
    ) -> None:
        self.repository = repository
        self.content_repository = content_repository
        self.results_repository = results_repository
        self.rag_repository = rag_repository
        self.vertex_model = vertex_model

    def get_quiz(self, student_id: int, subtopic_id: int) -> QuizPayloadDTO:
        progress = self.repository.get_progress(student_id, subtopic_id)
        stage = "first" if progress.total_sessions == 0 else "personalized"
        if stage == "first":
            questions = self.repository.get_manual_questions(subtopic_id)
        else:
            questions = self._build_personalized(student_id, subtopic_id, progress.current_level)
        session = self.repository.create_session(student_id, subtopic_id)
        return self._to_payload(session.id, subtopic_id, stage, questions)

    def generate_quiz(self, student_id: int, subtopic_id: int) -> QuizPayloadDTO:
        progress = self.repository.get_progress(student_id, subtopic_id)
        questions = self._build_personalized(student_id, subtopic_id, progress.current_level)
        session = self.repository.create_session(student_id, subtopic_id)
        return self._to_payload(session.id, subtopic_id, "personalized", questions)

    def _build_personalized(self, student_id: int, subtopic_id: int, level: str) -> list[Question]:
        if self.vertex_model:
            ai_questions = self._generate_ai_questions(student_id, subtopic_id, level)
            if ai_questions:
                return ai_questions
        return self.repository.create_personalized_questions(student_id, subtopic_id, level)

    def _generate_ai_questions(self, student_id: int, subtopic_id: int, level: str) -> list[Question]:
        from app.services.ai_service import generate_quiz_questions

        try:
            content = self.content_repository.get_content(subtopic_id, level)
            subtopic = self.content_repository.get_subtopic(subtopic_id)
        except Exception:
            return []

        chunks: list[str] = []
        if self.rag_repository:
            chunks = self.rag_repository.retrieve(subtopic.title, subtopic_id, top_k=5)

        raw_questions = generate_quiz_questions(
            vertex_model=self.vertex_model,  # type: ignore[arg-type]
            subtopic_title=subtopic.title,
            group_name=subtopic.group_name,
            level=level,
            content_body=content.body,
            context_chunks=chunks if chunks else None,
            count=15,
        )
        if not raw_questions:
            return []

        questions: list[Question] = []
        for i, q in enumerate(raw_questions):
            questions.append(
                Question(
                    id=-(i + 1),
                    subtopic_id=subtopic_id,
                    question_text=str(q.get("question_text", "")),
                    option_a=str(q.get("option_a", "")),
                    option_b=str(q.get("option_b", "")),
                    option_c=str(q.get("option_c", "")),
                    option_d=str(q.get("option_d", "")),
                    correct_answer=str(q.get("correct_answer", "A")).upper(),
                    difficulty=str(q.get("difficulty", "medium")),
                    source="gemini-ai",
                    stage="personalized",
                    student_id=student_id,
                    is_diagnostic=False,
                    created_at=datetime.now(UTC),
                )
            )
        stored = self.repository.store_ai_questions(student_id, subtopic_id, questions)
        return stored if stored else questions

    def _to_payload(
        self,
        session_id: int,
        subtopic_id: int,
        stage: str,
        questions: list[Question],
    ) -> QuizPayloadDTO:
        return QuizPayloadDTO(
            session_id=session_id,
            subtopic_id=subtopic_id,
            subtopic_title=self.repository.get_subtopic_title(subtopic_id),
            stage=stage,
            total_questions=len(questions),
            questions=[
                QuizQuestionDTO(
                    id=item.id,
                    subtopic_id=item.subtopic_id,
                    question_text=item.question_text,
                    option_a=item.option_a,
                    option_b=item.option_b,
                    option_c=item.option_c,
                    option_d=item.option_d,
                    correct_answer=item.correct_answer,
                    difficulty=item.difficulty,
                    source=item.source,
                    stage=item.stage,
                    student_id=item.student_id,
                )
                for item in questions
            ],
        )
