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
        if not self.groq_client:
            return (
                f"For a {level} learner, the best answer is {correct_answer} because it fits the chemistry pattern asked in the question. "
                f"Your choice {student_answer} leaves out the strongest clue from the options, so review the matching trend before the next session."
            )

        settings = get_settings()
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
