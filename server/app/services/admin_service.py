from __future__ import annotations

from app.core.errors import EduFXError
from app.core.rules import select_weak_concepts
from app.models.dto import (
    AdminSessionHistoryItemDTO,
    AdminStudentDetailDTO,
    AdminStudentSummaryDTO,
    AdminWeakConceptDTO,
    ProgressHistoryItemDTO,
    ProgressRecordDTO,
    SubtopicLiteDTO,
)
from app.repositories.admin_repository import AdminRepository
from app.repositories.contracts import AdminRepositoryContract

MASTERED_LEVEL = "advanced"


class AdminService:
    def __init__(self, repository: AdminRepositoryContract | AdminRepository) -> None:
        self.repository = repository

    def list_students_summary(self) -> list[AdminStudentSummaryDTO]:
        summaries: list[AdminStudentSummaryDTO] = []
        for student in self.repository.list_students():
            progress = self.repository.get_student_progress_all(student.id)
            sessions = self.repository.get_student_sessions(student.id)
            focus_scores = [s.focus_score for s in sessions if s.focus_score is not None]

            summaries.append(
                AdminStudentSummaryDTO(
                    student_id=student.id,
                    name=student.name,
                    email=student.email,
                    role=student.role,  # type: ignore[arg-type]
                    diagnostic_completed=student.diagnostic_completed,
                    subtopics_mastered=sum(1 for p in progress if p.current_level == MASTERED_LEVEL),
                    avg_focus_score=round(sum(focus_scores) / len(focus_scores)) if focus_scores else None,
                    total_sessions=len(sessions),
                    last_active_date=max((s.created_at.date() for s in sessions), default=None),
                )
            )
        return summaries

    def get_student_detail(self, student_id: int) -> AdminStudentDetailDTO:
        students = {s.id: s for s in self.repository.list_students()}
        student = students.get(student_id)
        if student is None:
            raise EduFXError("Student not found", status_code=404)

        subtopics_by_id = {item.id: item for item in self.repository.list_subtopics()}
        progress_records = self.repository.get_student_progress_all(student_id)
        sessions = self.repository.get_student_sessions(student_id)

        sessions_by_subtopic: dict[int, list] = {}
        for session in sessions:
            sessions_by_subtopic.setdefault(session.subtopic_id, []).append(session)

        progress_dtos: list[ProgressRecordDTO] = []
        for record in progress_records:
            subtopic = subtopics_by_id.get(record.subtopic_id)
            history = sessions_by_subtopic.get(record.subtopic_id, [])
            progress_dtos.append(
                ProgressRecordDTO(
                    id=record.id,
                    subtopic_id=record.subtopic_id,
                    current_level=record.current_level,  # type: ignore[arg-type]
                    last_studied_date=record.last_studied_date,
                    last_quiz_score=record.last_quiz_score,
                    total_sessions=record.total_sessions,
                    subtopics=SubtopicLiteDTO(id=subtopic.id, title=subtopic.title, group_name=subtopic.group_name)
                    if subtopic
                    else SubtopicLiteDTO(id=record.subtopic_id, title="Unknown", group_name=""),
                    session_history=[
                        ProgressHistoryItemDTO(
                            id=item.id,
                            session_date=item.session_date,
                            quiz_score=item.quiz_score,
                            focus_score=item.focus_score,
                            created_at=item.created_at,
                        )
                        for item in history
                    ],
                )
            )

        session_history_dtos = [
            AdminSessionHistoryItemDTO(
                session_id=session.id,
                subtopic_id=session.subtopic_id,
                subtopic_title=subtopics_by_id[session.subtopic_id].title
                if session.subtopic_id in subtopics_by_id
                else "Unknown",
                session_date=session.session_date,
                quiz_score=session.quiz_score,
                focus_score=session.focus_score,
            )
            for session in sessions
        ]

        weak_attempts = self.repository.get_student_weak_attempts(student_id)
        weak_concepts = [
            AdminWeakConceptDTO(
                concept=item["concept"],
                attempts=item["attempts"],
                correct=item["correct"],
                accuracy=item["accuracy"],
                sample_question=item.get("sample_question"),
            )
            for item in select_weak_concepts(weak_attempts)
        ]

        return AdminStudentDetailDTO(
            student_id=student.id,
            name=student.name,
            email=student.email,
            role=student.role,  # type: ignore[arg-type]
            diagnostic_completed=student.diagnostic_completed,
            progress=progress_dtos,
            session_history=session_history_dtos,
            weak_concepts=weak_concepts,
        )

    def set_student_role(self, student_id: int, role: str) -> AdminStudentDetailDTO:
        students = {s.id: s for s in self.repository.list_students()}
        if student_id not in students:
            raise EduFXError("Student not found", status_code=404)
        self.repository.set_student_role(student_id, role)
        return self.get_student_detail(student_id)
