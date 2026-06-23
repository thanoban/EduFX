import httpx
from groq import Groq

from app.core.config import get_settings
from app.repositories.results_repository import ResultsRepository


class ExplanationService:
    def __init__(self, repository: ResultsRepository, groq_client: Groq | None) -> None:
        self.repository = repository
        self.groq_client = groq_client

    def get_explanations(self, session_id: int, student_id: int) -> list[dict[str, str | int]]:
        attempts = self.repository.get_attempts(session_id)
        session = self.repository.get_session(session_id)
        progress = self.repository.get_progress(student_id, session.subtopic_id)
        explanations: list[dict[str, str | int]] = []
        for attempt in attempts:
            if attempt.is_correct:
                continue
            question = self.repository.get_question(attempt.question_id)
            explanation = self._build_explanation(
                level=progress.current_level,
                question_text=question.question_text,
                option_a=question.option_a,
                option_b=question.option_b,
                option_c=question.option_c,
                option_d=question.option_d,
                student_answer=attempt.student_answer,
                correct_answer=question.correct_answer,
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
    ) -> str:
        settings = get_settings()

        if self.groq_client:
            prompt = (
                "You are explaining one wrong chemistry MCQ answer.\n"
                f"Student level: {level}\n"
                f"Question: {question_text}\n"
                f"Options: A={option_a}; B={option_b}; C={option_c}; D={option_d}\n"
                f"Student answered: {student_answer}\n"
                f"Correct answer: {correct_answer}\n"
                "Explain why the correct answer is right and why the student's choice is wrong. "
                "Use plain text only. Maximum 3 sentences."
            )
            completion = self.groq_client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            return completion.choices[0].message.content or (
                f"The correct answer is {correct_answer}. Your answer {student_answer} does not match the strongest chemistry evidence in the options."
            )

        if settings.gemini_api_key:
            gemini_response = self._build_gemini_explanation(
                settings=settings,
                level=level,
                question_text=question_text,
                option_a=option_a,
                option_b=option_b,
                option_c=option_c,
                option_d=option_d,
                student_answer=student_answer,
                correct_answer=correct_answer,
            )
            if gemini_response:
                return gemini_response

        return (
            f"For a {level} learner, the best answer is {correct_answer} because it fits the chemistry pattern asked in the question. "
            f"Your choice {student_answer} leaves out the strongest clue from the options, so review the matching trend before the next session."
        )

    def _build_gemini_explanation(
        self,
        *,
        settings,
        level: str,
        question_text: str,
        option_a: str,
        option_b: str,
        option_c: str,
        option_d: str,
        student_answer: str,
        correct_answer: str,
    ) -> str | None:
        model_name = settings.gemini_model.replace("models/", "", 1)
        prompt = (
            "You are explaining one wrong chemistry MCQ answer.\n"
            f"Student level: {level}\n"
            f"Question: {question_text}\n"
            f"Options: A={option_a}; B={option_b}; C={option_c}; D={option_d}\n"
            f"Student answered: {student_answer}\n"
            f"Correct answer: {correct_answer}\n"
            "Explain why the correct answer is right and why the student's choice is wrong. "
            "Use plain text only. Maximum 3 sentences."
        )
        try:
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
                params={"key": settings.gemini_api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 180,
                    },
                },
                timeout=20.0,
            )
            response.raise_for_status()
            payload = response.json()
            candidates = payload.get("candidates") or []
            if not candidates:
                return None
            content = candidates[0].get("content") or {}
            parts = content.get("parts") or []
            text_parts = [part.get("text", "").strip() for part in parts if part.get("text")]
            explanation = " ".join(text_parts).strip()
            return explanation or None
        except httpx.HTTPError:
            return None
