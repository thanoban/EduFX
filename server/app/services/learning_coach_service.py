from __future__ import annotations

from collections import Counter

from app.models.domain import Question, QuizAttempt, SessionSummary, StudentProgress
from app.models.dto import CoachActionDTO, CoachInsightDTO, CoachPlanDTO
from app.repositories.contracts import ResultsRepositoryContract
from app.repositories.results_repository import ResultsRepository


class PerformanceAgent:
    def analyze(self, session: SessionSummary) -> CoachInsightDTO:
        score = session.quiz_score
        if score >= 80:
            return CoachInsightDTO(
                agent="performance",
                title="Performance agent",
                summary="The quiz result is strong enough to protect momentum and add one challenge task.",
                severity="success",
                evidence=[f"Quiz score: {score}%", f"Correct answers: {session.correct_answers}/{session.total_questions}"],
            )
        if score >= 60:
            return CoachInsightDTO(
                agent="performance",
                title="Performance agent",
                summary="The score is close to secure mastery, so the next step should repair mistakes before increasing difficulty.",
                severity="warning",
                evidence=[f"Quiz score: {score}%", f"Correct answers: {session.correct_answers}/{session.total_questions}"],
            )
        return CoachInsightDTO(
            agent="performance",
            title="Performance agent",
            summary="The score shows a high-risk gap. The student should revisit the notes before another timed quiz.",
            severity="danger",
            evidence=[f"Quiz score: {score}%", f"Correct answers: {session.correct_answers}/{session.total_questions}"],
        )


class ConceptAgent:
    def analyze(self, attempts: list[QuizAttempt], questions: dict[int, Question]) -> CoachInsightDTO:
        missed_concepts: Counter[str] = Counter()
        missed_samples: list[str] = []
        for attempt in attempts:
            if attempt.is_correct:
                continue
            question = questions[attempt.question_id]
            concept = question.concept or "core-topic"
            missed_concepts[concept] += 1
            if len(missed_samples) < 2:
                missed_samples.append(question.question_text)

        if not missed_concepts:
            return CoachInsightDTO(
                agent="concept",
                title="Concept agent",
                summary="No wrong-answer concept cluster was detected in this session.",
                severity="success",
                evidence=["All attempted questions were correct."],
            )

        top_concept, count = missed_concepts.most_common(1)[0]
        return CoachInsightDTO(
            agent="concept",
            title="Concept agent",
            summary=f"The main repair target is `{top_concept}` because it appeared most often in wrong answers.",
            severity="warning" if count <= 2 else "danger",
            evidence=[f"{top_concept}: {count} missed question(s)", *missed_samples],
        )


class FocusAgent:
    def analyze(self, session: SessionSummary) -> CoachInsightDTO:
        if not session.webcam_enabled or session.focus_score is None:
            return CoachInsightDTO(
                agent="focus",
                title="Focus agent",
                summary="Focus data was not available, so the coaching plan relies on quiz evidence only.",
                severity="info",
                evidence=["Webcam tracking was skipped or unavailable."],
            )

        alerts = {
            "phone": session.phone_percent,
            "away": session.away_percent,
            "drowsy": session.drowsy_percent,
            "talking": session.talking_percent,
            "absent": session.absent_percent,
        }
        top_alert, top_percent = max(alerts.items(), key=lambda item: item[1])
        if session.focus_score >= 80:
            severity = "success"
            summary = "Focus supported learning in this session."
        elif session.focus_score >= 60:
            severity = "warning"
            summary = f"Focus was usable but should improve, especially around {top_alert} alerts."
        else:
            severity = "danger"
            summary = f"Focus likely reduced learning quality; the biggest signal was {top_alert} alerts."

        return CoachInsightDTO(
            agent="focus",
            title="Focus agent",
            summary=summary,
            severity=severity,
            evidence=[f"Focus score: {session.focus_score}%", f"Top alert: {top_alert} {top_percent}%"],
        )


class PlannerAgent:
    def plan(
        self,
        *,
        session: SessionSummary,
        progress: StudentProgress,
        insights: list[CoachInsightDTO],
    ) -> CoachPlanDTO:
        danger_count = sum(1 for insight in insights if insight.severity == "danger")
        warning_count = sum(1 for insight in insights if insight.severity == "warning")
        actions: list[CoachActionDTO] = []

        if session.quiz_score < 70:
            actions.append(
                CoachActionDTO(
                    label="Re-read the current notes",
                    reason="The quiz score is below the mastery threshold, so reviewing before retrying avoids repeating the same errors.",
                    priority="high",
                    subtopic_id=session.subtopic_id,
                )
            )
        else:
            actions.append(
                CoachActionDTO(
                    label="Try a harder follow-up quiz",
                    reason="The score is strong enough to test whether the concept transfers to new wording.",
                    priority="medium",
                    subtopic_id=session.subtopic_id,
                )
            )

        concept_insight = next((insight for insight in insights if insight.agent == "concept"), None)
        if concept_insight and concept_insight.severity != "success":
            actions.append(
                CoachActionDTO(
                    label="Repair the weakest concept",
                    reason=concept_insight.summary,
                    priority="high",
                    subtopic_id=session.subtopic_id,
                )
            )

        focus_insight = next((insight for insight in insights if insight.agent == "focus"), None)
        if focus_insight and focus_insight.severity in {"warning", "danger"}:
            actions.append(
                CoachActionDTO(
                    label="Run the next quiz with fewer distractions",
                    reason=focus_insight.summary,
                    priority="medium",
                    subtopic_id=session.subtopic_id,
                )
            )

        if not actions:
            actions.append(
                CoachActionDTO(
                    label="Continue today's study plan",
                    reason="No urgent performance, concept, or focus issue was detected.",
                    priority="low",
                    subtopic_id=None,
                )
            )

        if danger_count:
            headline = "Recovery plan: fix the blocking gap before moving on."
            confidence = "high"
        elif warning_count:
            headline = "Targeted plan: repair the weak spot, then retest."
            confidence = "medium"
        else:
            headline = "Momentum plan: keep the topic active and increase challenge."
            confidence = "high"

        return CoachPlanDTO(
            session_id=session.id,
            student_id=session.student_id,
            headline=headline,
            confidence=confidence,
            insights=[
                *insights,
                CoachInsightDTO(
                    agent="planner",
                    title="Planner agent",
                    summary=f"Current stored level after this session is `{progress.current_level}`.",
                    severity="info",
                    evidence=[f"Recommended actions: {len(actions)}"],
                ),
            ],
            actions=actions[:3],
        )


class LearningCoachService:
    def __init__(self, repository: ResultsRepositoryContract | ResultsRepository) -> None:
        self.repository = repository
        self.performance_agent = PerformanceAgent()
        self.concept_agent = ConceptAgent()
        self.focus_agent = FocusAgent()
        self.planner_agent = PlannerAgent()

    def build_session_plan(self, session_id: int, student_id: int) -> CoachPlanDTO:
        session = self.repository.get_session(session_id)
        attempts = self.repository.get_attempts(session_id)
        questions = {attempt.question_id: self.repository.get_question(attempt.question_id) for attempt in attempts}
        progress = self.repository.get_progress(student_id, session.subtopic_id)
        insights = [
            self.performance_agent.analyze(session),
            self.concept_agent.analyze(attempts, questions),
            self.focus_agent.analyze(session),
        ]
        return self.planner_agent.plan(session=session, progress=progress, insights=insights)
