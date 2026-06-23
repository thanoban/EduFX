from app.models.dto import QuizPayloadDTO, QuizQuestionDTO
from app.repositories.contracts import ContentRepositoryContract, QuizRepositoryContract, ResultsRepositoryContract
from app.repositories.content_repository import ContentRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository


class QuizService:
    def __init__(
        self,
        repository: QuizRepositoryContract | QuizRepository,
        content_repository: ContentRepositoryContract | ContentRepository,
        results_repository: ResultsRepositoryContract | ResultsRepository,
    ) -> None:
        self.repository = repository
        self.content_repository = content_repository
        self.results_repository = results_repository

    def get_quiz(self, student_id: int, subtopic_id: int) -> QuizPayloadDTO:
        progress = self.repository.get_progress(student_id, subtopic_id)
        stage = "first" if progress.total_sessions == 0 else "personalized"
        questions = (
            self.repository.get_manual_questions(subtopic_id)
            if stage == "first"
            else self.repository.create_personalized_questions(student_id, subtopic_id, progress.current_level)
        )
        session = self.repository.create_session(student_id, subtopic_id)
        return QuizPayloadDTO(
            session_id=session.id,
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

    def generate_quiz(self, student_id: int, subtopic_id: int) -> QuizPayloadDTO:
        progress = self.repository.get_progress(student_id, subtopic_id)
        questions = self.repository.create_personalized_questions(student_id, subtopic_id, progress.current_level)
        session = self.repository.create_session(student_id, subtopic_id)
        return QuizPayloadDTO(
            session_id=session.id,
            subtopic_id=subtopic_id,
            subtopic_title=self.repository.get_subtopic_title(subtopic_id),
            stage="personalized",
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
