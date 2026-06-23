from app.core.store import DemoDataStore
from app.models.domain import Question, SessionSummary, StudentProgress


class QuizRepository:
    def __init__(self, store: DemoDataStore) -> None:
        self.store = store

    def get_progress(self, student_id: int, subtopic_id: int) -> StudentProgress:
        self.store.ensure_progress_records(student_id)
        return self.store.student_progress[(student_id, subtopic_id)]

    def get_manual_questions(self, subtopic_id: int) -> list[Question]:
        return [
            question
            for question in self.store.questions.values()
            if question.subtopic_id == subtopic_id and question.stage == "first"
        ]

    def create_personalized_questions(self, student_id: int, subtopic_id: int, level: str) -> list[Question]:
        manual = self.get_manual_questions(subtopic_id)
        prioritized: list[Question] = []
        recent_attempts = []
        for attempts in self.store.quiz_attempts.values():
            recent_attempts.extend(
                [
                    attempt
                    for attempt in attempts
                    if attempt.student_id == student_id and attempt.subtopic_id == subtopic_id and not attempt.is_correct
                ]
            )
        wrong_ids = [attempt.question_id for attempt in recent_attempts]
        focused = [question for question in manual if question.id in wrong_ids]
        remaining = [question for question in manual if question.id not in wrong_ids]
        difficulty_map = {"beginner": "easy", "intermediate": "medium", "advanced": "hard"}
        difficulty_target = difficulty_map[level]
        level_matched = [question for question in manual if question.difficulty == difficulty_target]
        untouched = [question for question in remaining if question.id not in wrong_ids]

        def add_batch(batch: list[Question], limit: int) -> None:
            for question in batch:
                if question not in prioritized:
                    prioritized.append(question)
                if len(prioritized) >= limit:
                    break

        add_batch(focused, 6)
        add_batch(remaining, 10)
        add_batch(level_matched, 13)
        add_batch(list(reversed(untouched or manual)), 15)
        add_batch(manual, 15)
        picked = prioritized[:15]
        generated = [self.store.clone_question(question, student_id, "personalized") for question in picked]
        self.store.generated_questions_by_student[(student_id, subtopic_id)] = [item.id for item in generated]
        return generated

    def create_session(self, student_id: int, subtopic_id: int) -> SessionSummary:
        return self.store.create_session(student_id, subtopic_id)

    def get_subtopic_title(self, subtopic_id: int) -> str:
        return self.store.subtopics[subtopic_id].title

    def get_generated_questions(self, student_id: int, subtopic_id: int) -> list[Question]:
        ids = self.store.generated_questions_by_student.get((student_id, subtopic_id), [])
        return [self.store.questions[item_id] for item_id in ids]

    def store_ai_questions(self, student_id: int, subtopic_id: int, questions: list[Question]) -> list[Question]:
        stored = [self.store.clone_question(q, student_id, "personalized") for q in questions]
        self.store.generated_questions_by_student[(student_id, subtopic_id)] = [q.id for q in stored]
        return stored
