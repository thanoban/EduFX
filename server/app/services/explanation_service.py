from __future__ import annotations

from app.repositories.rag_repository import RagRepository
from app.repositories.results_repository import ResultsRepository


class ExplanationService:
    def __init__(
        self,
        repository: ResultsRepository,
        rag_repository: RagRepository | None = None,
        vertex_model: str | None = None,
    ) -> None:
        self.repository = repository
        self.rag_repository = rag_repository
        self.vertex_model = vertex_model

    def get_explanations(self, session_id: int, student_id: int) -> list[dict[str, str | int]]:
        from app.services.ai_service import generate_explanation

        attempts = self.repository.get_attempts(session_id)
        session = self.repository.get_session(session_id)
        progress = self.repository.get_progress(student_id, session.subtopic_id)
        explanations: list[dict[str, str | int]] = []

        for attempt in attempts:
            if attempt.is_correct:
                continue
            question = self.repository.get_question(attempt.question_id)

            chunks: list[str] = []
            if self.rag_repository:
                chunks = self.rag_repository.retrieve(question.question_text, session.subtopic_id)

            if self.vertex_model:
                text = generate_explanation(
                    vertex_model=self.vertex_model,
                    level=progress.current_level,
                    question_text=question.question_text,
                    option_a=question.option_a,
                    option_b=question.option_b,
                    option_c=question.option_c,
                    option_d=question.option_d,
                    student_answer=attempt.student_answer,
                    correct_answer=question.correct_answer,
                    context_chunks=chunks if chunks else None,
                )
                explanation = text or self._fallback(progress.current_level, attempt.student_answer, question.correct_answer)
            else:
                explanation = self._fallback(progress.current_level, attempt.student_answer, question.correct_answer)

            attempt.explanation = explanation
            explanations.append({"attempt_id": attempt.id, "explanation": explanation})

        return explanations

    @staticmethod
    def _fallback(level: str, student_answer: str, correct_answer: str) -> str:
        return (
            f"For a {level} learner, the best answer is {correct_answer} because it fits the "
            f"chemistry pattern asked in the question. Your choice {student_answer} leaves out the "
            "strongest clue from the options, so review the matching trend before the next session."
        )
