"""Assemble a student's full learning picture into one structured snapshot.

Deterministic and READ-ONLY: no LLM, no mutation, no scheduling. Both the AI
teacher chat and the auto-report run on the dossier this builds, and the
grounding guard checks the teacher's reply against it. Reuses the existing
analytics helpers (`select_weak_concepts`, `aggregate_behaviour`) and the
model's mastery estimates so the agent layer adds no new business logic.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.core.rules import select_weak_concepts
from app.ml import mastery_to_level
from app.ml.recommender_engine import RecommenderEngine
from app.repositories.progress_repository import ProgressRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository

_RECENT_SESSIONS = 8


@dataclass
class SubtopicSnapshot:
    subtopic_id: int
    title: str
    group_name: str
    level: str
    last_quiz_score: int
    total_sessions: int
    model_mastery: float  # 0..1, blended DKT/BKT + level proxy
    model_level: str      # mastery mapped to beginner/intermediate/advanced


@dataclass
class StudentDossier:
    student_id: int
    name: str
    diagnostic_completed: bool
    current_streak: int
    longest_streak: int
    total_sessions: int
    avg_quiz_score: float | None
    avg_focus: float | None
    subtopics: list[SubtopicSnapshot] = field(default_factory=list)
    weak_concepts: list[dict] = field(default_factory=list)
    behaviour: dict = field(default_factory=dict)


def _avg(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def build_student_dossier(
    student_id: int,
    *,
    results_repository: ResultsRepository,
    progress_repository: ProgressRepository,
    scheduler_repository: SchedulerRepository,
    quiz_repository: QuizRepository,
    recommender_engine: RecommenderEngine,
) -> StudentDossier | None:
    student = results_repository.get_student(student_id)
    if student is None:
        return None

    progress_records = progress_repository.get_progress_records(student_id)
    subtopics_by_id = {item.id: item for item in progress_repository.list_subtopics()}
    mastery = recommender_engine.mastery_by_subtopic(student_id)

    subtopics: list[SubtopicSnapshot] = []
    for progress in sorted(progress_records, key=lambda p: p.subtopic_id):
        subtopic = subtopics_by_id.get(progress.subtopic_id)
        if subtopic is None:
            continue
        m = mastery.get(progress.subtopic_id, 0.25)
        subtopics.append(
            SubtopicSnapshot(
                subtopic_id=progress.subtopic_id,
                title=subtopic.title,
                group_name=subtopic.group_name,
                level=progress.current_level,
                last_quiz_score=progress.last_quiz_score,
                total_sessions=progress.total_sessions,
                model_mastery=round(m, 3),
                model_level=mastery_to_level(m),
            )
        )

    # Weak concepts across every subtopic the student has touched — reuse the
    # exact join+scoring path quiz generation uses, then rank once globally.
    all_weak_attempts: list[dict] = []
    for progress in progress_records:
        if progress.total_sessions <= 0:
            continue
        all_weak_attempts.extend(quiz_repository.get_weak_attempts(student_id, progress.subtopic_id))
    weak_concepts = select_weak_concepts(all_weak_attempts)

    sessions = progress_repository.get_student_session_history(student_id)
    recent = sessions[:_RECENT_SESSIONS]
    quiz_scores = [s.quiz_score for s in sessions if s.total_questions > 0]
    focus_scores = [s.focus_score for s in recent if s.focus_score is not None]
    behaviour = {
        "avg_phone_percent": _avg([s.phone_percent for s in recent]),
        "avg_away_percent": _avg([s.away_percent for s in recent]),
        "avg_absent_percent": _avg([s.absent_percent for s in recent]),
        "sessions_with_webcam": sum(1 for s in recent if s.webcam_enabled),
        "recent_sessions": len(recent),
    }

    return StudentDossier(
        student_id=student_id,
        name=student.name,
        diagnostic_completed=student.diagnostic_completed,
        current_streak=student.current_streak,
        longest_streak=student.longest_streak,
        total_sessions=len(sessions),
        avg_quiz_score=_avg(quiz_scores),
        avg_focus=_avg([float(v) for v in focus_scores]),
        subtopics=subtopics,
        weak_concepts=weak_concepts,
        behaviour=behaviour,
    )


def dossier_to_prompt_context(dossier: StudentDossier) -> str:
    """Render the dossier as compact, LLM-readable text for the agent prompts."""
    lines: list[str] = []
    lines.append(f"Student: {dossier.name}")
    lines.append(
        f"Overall: {dossier.total_sessions} study sessions, "
        f"avg quiz score {dossier.avg_quiz_score if dossier.avg_quiz_score is not None else 'n/a'}%, "
        f"avg focus {dossier.avg_focus if dossier.avg_focus is not None else 'n/a'}%, "
        f"current streak {dossier.current_streak} day(s) (best {dossier.longest_streak})."
    )
    lines.append("")
    lines.append("Per-subtopic performance:")
    for s in dossier.subtopics:
        lines.append(
            f"- {s.title} ({s.group_name}): level={s.level}, last quiz {s.last_quiz_score}%, "
            f"{s.total_sessions} session(s), model mastery {int(s.model_mastery * 100)}% ({s.model_level})."
        )
    lines.append("")
    if dossier.weak_concepts:
        lines.append("Weakest concepts (lowest accuracy first):")
        for w in dossier.weak_concepts[:8]:
            lines.append(
                f"- {w['concept']}: {w['correct']}/{w['attempts']} correct "
                f"({int(w['accuracy'] * 100)}%)."
            )
    else:
        lines.append("Weakest concepts: none flagged yet (not enough wrong answers to analyse).")
    lines.append("")
    b = dossier.behaviour
    lines.append(
        "Recent focus behaviour: "
        f"phone {b.get('avg_phone_percent')}%, looking away {b.get('avg_away_percent')}%, "
        f"absent {b.get('avg_absent_percent')}% (across {b.get('recent_sessions')} recent sessions)."
    )
    return "\n".join(lines)
