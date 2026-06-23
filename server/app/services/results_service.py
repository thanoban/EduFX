from datetime import UTC, datetime

from app.core.rules import update_level_after_quiz
from app.models.domain import QuizAttempt
from app.models.dto import QuestionWithAttemptDTO, QuizQuestionDTO, QuizResultDTO, SessionResultsDTO
from app.repositories.contracts import BehaviourRepositoryContract, QuizRepositoryContract, ResultsRepositoryContract
from app.repositories.behaviour_repository import BehaviourRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository


class ResultsService:
    def __init__(
        self,
        repository: ResultsRepositoryContract | ResultsRepository,
        quiz_repository: QuizRepositoryContract | QuizRepository,
        behaviour_repository: BehaviourRepositoryContract | BehaviourRepository,
    ) -> None:
        self.repository = repository
        self.quiz_repository = quiz_repository
        self.behaviour_repository = behaviour_repository

    def submit_quiz(
        self,
        student_id: int,
        session_id: int,
        subtopic_id: int,
        webcam_enabled: bool,
        answers: list[dict[str, str | int]],
    ) -> QuizResultDTO:
        session = self.repository.get_session(session_id)
        progress = self.repository.get_progress(student_id, subtopic_id)
        previous_level = progress.current_level

        correct_answers = 0
        for answer in answers:
            question = self.repository.get_question(int(answer["question_id"]))
            is_correct = str(answer["student_answer"]).upper() == question.correct_answer
            correct_answers += 1 if is_correct else 0
            self.repository.add_attempt(
                QuizAttempt(
                    id=0,
                    student_id=student_id,
                    session_id=session_id,
                    question_id=question.id,
                    subtopic_id=subtopic_id,
                    student_answer=str(answer["student_answer"]).upper(),
                    correct_answer=question.correct_answer,
                    is_correct=is_correct,
                    explanation=None,
                    created_at=datetime.now(UTC),
                )
            )

        total_questions = len(answers)
        quiz_score = round((correct_answers / max(total_questions, 1)) * 100)
        new_level = update_level_after_quiz(previous_level, quiz_score)

        progress.current_level = new_level
        progress.last_quiz_score = quiz_score
        progress.total_sessions += 1
        self.repository.save_progress(progress)

        session.quiz_score = quiz_score
        session.total_questions = total_questions
        session.correct_answers = correct_answers
        session.webcam_enabled = webcam_enabled
        self.repository.save_session(session)

        return QuizResultDTO(
            session_id=session_id,
            total_questions=total_questions,
            correct_answers=correct_answers,
            quiz_score=quiz_score,
            previous_level=previous_level,  # type: ignore[arg-type]
            new_level=new_level,  # type: ignore[arg-type]
            level_changed=previous_level != new_level,
            wrong_count=total_questions - correct_answers,
        )

    def get_session_results(self, session_id: int, student_id: int) -> SessionResultsDTO:
        session = self.repository.get_session(session_id)
        answers = self.repository.get_question_answers(session_id)
        attempts = [
            QuestionWithAttemptDTO(
                id=item.attempt.id,
                question_id=item.question.id,
                student_answer=item.attempt.student_answer,
                correct_answer=item.attempt.correct_answer,
                is_correct=item.attempt.is_correct,
                explanation=item.attempt.explanation,
                question=QuizQuestionDTO(
                    id=item.question.id,
                    subtopic_id=item.question.subtopic_id,
                    question_text=item.question.question_text,
                    option_a=item.question.option_a,
                    option_b=item.question.option_b,
                    option_c=item.question.option_c,
                    option_d=item.question.option_d,
                    correct_answer=item.question.correct_answer,
                    difficulty=item.question.difficulty,
                    source=item.question.source,
                    stage=item.question.stage,
                    student_id=item.question.student_id,
                ),
            )
            for item in answers
        ]
        return SessionResultsDTO(
            id=session.id,
            student_id=student_id,
            subtopic_id=session.subtopic_id,
            quiz_score=session.quiz_score,
            focus_score=session.focus_score,
            phone_percent=session.phone_percent,
            drowsy_percent=session.drowsy_percent,
            away_percent=session.away_percent,
            talking_percent=session.talking_percent,
            absent_percent=session.absent_percent,
            webcam_enabled=session.webcam_enabled,
            total_questions=session.total_questions,
            correct_answers=session.correct_answers,
            attempts=attempts,
        )
