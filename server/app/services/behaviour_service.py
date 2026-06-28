from app.core.rules import aggregate_behaviour, calculate_focus_score
from app.models.domain import BehaviourLog
from app.models.dto import BehaviourHistoryItemDTO, BehaviourSessionDTO, SubtopicLiteDTO
from app.repositories.contracts import BehaviourRepositoryContract
from app.repositories.behaviour_repository import BehaviourRepository


class BehaviourService:
    def __init__(self, repository: BehaviourRepositoryContract | BehaviourRepository) -> None:
        self.repository = repository

    def save_snapshot(self, payload: dict) -> dict:
        log = BehaviourLog(
            id=0,
            student_id=payload["student_id"],
            session_id=payload["session_id"],
            timestamp=self.repository.now(),
            face_detected=payload["face_detected"],
            looking_away=payload["looking_away"],
            phone_detected=payload["phone_detected"],
            drowsy=payload["drowsy"],
            multiple_persons=payload["multiple_persons"],
            talking=payload["talking"],
            absent=payload["absent"],
            focus_score=payload.get("focus_score", 0),
        )
        # Server is the source of truth: always derive the focus score from the
        # detected flags rather than trusting the client-sent value.
        log.focus_score = calculate_focus_score(log)
        saved = self.repository.add_snapshot(log)
        return {"snapshot_id": saved.id, "focus_score": saved.focus_score}

    def save_summary(self, payload: dict) -> dict:
        session = self.repository.get_session(payload["session_id"])
        webcam_enabled = payload["webcam_enabled"]
        session.webcam_enabled = webcam_enabled

        snapshots = self.repository.list_snapshots(session.id) if webcam_enabled else []

        if not webcam_enabled or not snapshots:
            # Untracked session (webcam off, or enabled but no frames captured):
            # there is no real focus signal, so store None rather than a misleading 0.
            session.phone_percent = 0
            session.drowsy_percent = 0
            session.away_percent = 0
            session.talking_percent = 0
            session.absent_percent = 0
            session.focus_score = None
        else:
            aggregate = aggregate_behaviour(snapshots)
            session.phone_percent = aggregate["phone_percent"]
            session.drowsy_percent = aggregate["drowsy_percent"]
            session.away_percent = aggregate["away_percent"]
            session.talking_percent = aggregate["talking_percent"]
            session.absent_percent = aggregate["absent_percent"]
            session.focus_score = aggregate["focus_score"]

        self.repository.save_session(session)
        return {"session_id": session.id, "focus_score": session.focus_score}

    def get_session(self, session_id: int) -> BehaviourSessionDTO:
        session = self.repository.get_session(session_id)
        snapshots = self.repository.list_snapshots(session_id)
        return BehaviourSessionDTO(
            student_id=session.student_id,
            session_id=session.id,
            subtopic_id=session.subtopic_id,
            webcam_enabled=session.webcam_enabled,
            phone_percent=session.phone_percent,
            drowsy_percent=session.drowsy_percent,
            away_percent=session.away_percent,
            talking_percent=session.talking_percent,
            absent_percent=session.absent_percent,
            focus_score=session.focus_score,
            snapshots=snapshots,
        )

    def get_student_history(self, student_id: int) -> list[BehaviourHistoryItemDTO]:
        sessions = self.repository.list_student_sessions(student_id)
        payload: list[BehaviourHistoryItemDTO] = []
        for session in sessions:
            subtopic = self.repository.get_subtopic(session.subtopic_id)
            payload.append(
                BehaviourHistoryItemDTO(
                    id=session.id,
                    student_id=session.student_id,
                    subtopic_id=session.subtopic_id,
                    session_date=session.session_date,
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
                    created_at=session.created_at,
                    subtopics=SubtopicLiteDTO(id=subtopic.id, title=subtopic.title, group_name=subtopic.group_name)
                    if subtopic
                    else None,
                )
            )
        return payload
