from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.repositories.rag_repository import RagRepository
from app.repositories.results_repository import ResultsRepository


class ExplanationService:
    def __init__(
        self,
        repository: ResultsRepository,
        rag_repository: RagRepository | None = None,
    ) -> None:
        self.repository = repository
        self.rag_repository = rag_repository

    def get_explanations(self, session_id: int, student_id: int) -> list[dict[str, str | int]]:
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

            explanation = self._build_explanation(
                level=progress.current_level,
                question_text=question.question_text,
                option_a=question.option_a,
                option_b=question.option_b,
                option_c=question.option_c,
                option_d=question.option_d,
                student_answer=attempt.student_answer,
                correct_answer=question.correct_answer,
                context_chunks=chunks,
            )
            attempt.explanation = explanation
            explanations.append({"attempt_id": attempt.id, "explanation": explanation})

        return explanations

    def _build_explanation(
        self,
        *,
        level: str,
        question_text: str,
        option_a: str,
        option_b: str,
        option_c: str,
        option_d: str,
        student_answer: str,
        correct_answer: str,
        context_chunks: list[str] | None = None,
    ) -> str:
        settings = get_settings()

        rag_section = ""
        if context_chunks:
            rag_section = "Relevant notes:\n" + "\n---\n".join(context_chunks) + "\n\n"

        prompt = (
            "You are an A-Level Chemistry teacher explaining a wrong answer.\n"
            f"Student level: {level}\n"
            f"{rag_section}"
            f"Question: {question_text}\n"
            f"Options: A={option_a}; B={option_b}; C={option_c}; D={option_d}\n"
            f"Student answered: {student_answer}\n"
            f"Correct answer: {correct_answer}\n"
            "Explain why the correct answer is right and why the student's choice is wrong. "
            "Use plain text only. Maximum 3 sentences."
        )

        if settings.gemini_api_key:
            result = self._call_gemini(settings.gemini_api_key, settings.gemini_model, prompt)
            if result:
                return result

        return (
            f"For a {level} learner, the best answer is {correct_answer} because it fits the "
            f"chemistry pattern asked in the question. Your choice {student_answer} leaves out the "
            "strongest clue from the options, so review the matching trend before the next session."
        )

    @staticmethod
    def _call_gemini(api_key: str, model: str, prompt: str) -> str | None:
        model_name = model.replace("models/", "", 1)
        try:
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 180},
                },
                timeout=20.0,
            )
            response.raise_for_status()
            payload = response.json()
            candidates = payload.get("candidates") or []
            if not candidates:
                return None
            parts = candidates[0].get("content", {}).get("parts", [])
            text = " ".join(p.get("text", "").strip() for p in parts).strip()
            return text or None
        except httpx.HTTPError:
            return None
