from collections import defaultdict

from app.core.errors import EduFXError
from app.core.rules import score_to_level
from app.models.dto import DiagnosticQuestionDTO, DiagnosticResultDTO
from app.repositories.contracts import DiagnosticRepositoryContract
from app.repositories.diagnostic_repository import DiagnosticRepository


class DiagnosticService:
    def __init__(self, repository: DiagnosticRepositoryContract | DiagnosticRepository) -> None:
        self.repository = repository

    def get_questions(self) -> list[DiagnosticQuestionDTO]:
        return [
            DiagnosticQuestionDTO(
                id=question.id,
                subtopic_id=question.subtopic_id,
                question_text=question.question_text,
                option_a=question.option_a,
                option_b=question.option_b,
                option_c=question.option_c,
                option_d=question.option_d,
                correct_answer=question.correct_answer,
            )
            for question in self.repository.get_diagnostic_questions()
        ]

    def submit(self, student_id: int, answers: list[dict[str, str | int]]) -> list[DiagnosticResultDTO]:
        student = self.repository.get_student(student_id)
        if student is None:
            raise EduFXError("Student not found", status_code=404)

        questions = {question.id: question for question in self.repository.get_diagnostic_questions()}
        if len(answers) != len(questions):
            raise EduFXError("Diagnostic requires all 40 answers", status_code=422)

        expected_ids = set(questions.keys())
        answer_ids = {int(answer["question_id"]) for answer in answers}
        if answer_ids != expected_ids:
            raise EduFXError("Diagnostic answers are incomplete or mismatched", status_code=422)

        subtopic_scores: dict[int, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})

        for answer in answers:
            question = questions[int(answer["question_id"])]
            subtopic_scores[question.subtopic_id]["total"] += 1
            if str(answer["student_answer"]).upper() == question.correct_answer:
                subtopic_scores[question.subtopic_id]["correct"] += 1

        results: list[DiagnosticResultDTO] = []
        for question in questions.values():
            bucket = subtopic_scores[question.subtopic_id]
            score_percent = round((bucket["correct"] / max(bucket["total"], 1)) * 100)
            level = score_to_level(score_percent)
            self.repository.save_student_level(student_id, question.subtopic_id, level, score_percent)
        seen = set()
        for question in questions.values():
            if question.subtopic_id in seen:
                continue
            seen.add(question.subtopic_id)
            if subtopic_scores[question.subtopic_id]["total"] != 4:
                raise EduFXError("Each subtopic requires 4 diagnostic answers", status_code=422)
            score_percent = round(
                (subtopic_scores[question.subtopic_id]["correct"] / max(subtopic_scores[question.subtopic_id]["total"], 1)) * 100
            )
            subtopic = self.repository.get_subtopic(question.subtopic_id)
            results.append(
                DiagnosticResultDTO(
                    subtopic_id=question.subtopic_id,
                    subtopic_title=subtopic.title,
                    score_percent=score_percent,
                    assigned_level=score_to_level(score_percent),
                )
            )
        if len(results) != 10:
            raise EduFXError("Diagnostic submission incomplete")
        self.repository.complete_diagnostic(student_id)
        return results
