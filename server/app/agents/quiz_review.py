"""Quiz self-check — a LangGraph verify->fix reflection loop.

LLM-generated MCQs can confidently mark the wrong option "correct". Serving that
to a student then "corrects" them with a wrong answer — the worst bug in an
education app. This loop has an examiner LLM check each generated question against
the source notes, drops the ones it flags, and (if a `regenerate` callback is
supplied) back-fills the shortfall and re-checks, up to a small retry cap.

    START -> verify -> [enough? / no regen? / out of retries?] --done--> END
                          |                                   `--regen--> regenerate -> verify

Fail-open by design: if the examiner is unavailable or returns unparseable output,
questions are KEPT, never silently dropped — the reviewer is a safety net, not a
gate that can nuke a quiz when the LLM is down.
"""
from __future__ import annotations

import json
import re
from typing import Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents import prompts
from app.models.domain import Question
from app.services import ai_service

_MAX_RETRIES = 1
_NOTES_CHAR_CAP = 4000


class QuizReviewState(TypedDict, total=False):
    content: str
    subtopic_title: str
    target_count: int
    questions: list  # current batch awaiting verification
    valid: list  # accumulated questions that passed
    retries: int
    regenerate: object  # Callable[[int], list[Question]] | None


def _questions_block(questions: list[Question]) -> str:
    blocks = []
    for i, q in enumerate(questions):
        blocks.append(
            f"[{i}] {q.question_text}\n"
            f"  A) {q.option_a}\n  B) {q.option_b}\n  C) {q.option_c}\n  D) {q.option_d}\n"
            f"  Marked correct: {q.correct_answer}"
        )
    return "\n\n".join(blocks)


def _parse_verdicts(raw: str, n: int) -> dict[int, bool]:
    """Map question index -> valid?. Empty dict on any failure (caller keeps all)."""
    if not raw:
        return {}
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
    try:
        data = json.loads(text)
    except Exception:
        return {}
    verdicts: dict[int, bool] = {}
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "index" in item:
                try:
                    verdicts[int(item["index"])] = bool(item.get("valid", True))
                except Exception:
                    continue
    return verdicts


def _verify(state: QuizReviewState) -> dict:
    questions = state.get("questions", [])
    if not questions:
        return {}
    prompt = (
        prompts.QUIZ_REVIEW_PROMPT
        + "\n\nSource notes:\n"
        + (state.get("content", "") or "")[:_NOTES_CHAR_CAP]
        + "\n\nQuestions:\n"
        + _questions_block(questions)
    )
    raw = ai_service.generate_text(prompt, temperature=0.0, max_tokens=1500)
    verdicts = _parse_verdicts(raw, len(questions))
    # Default True: a question with no verdict (or an unparseable response) is kept.
    kept = [q for i, q in enumerate(questions) if verdicts.get(i, True)]
    return {"valid": state.get("valid", []) + kept, "questions": []}


def _decide(state: QuizReviewState) -> str:
    if len(state.get("valid", [])) >= state.get("target_count", 0):
        return "done"
    if not state.get("regenerate"):
        return "done"
    if state.get("retries", 0) >= _MAX_RETRIES:
        return "done"
    return "regen"


def _regenerate(state: QuizReviewState) -> dict:
    shortfall = max(state.get("target_count", 0) - len(state.get("valid", [])), 0)
    regen: Callable[[int], list[Question]] | None = state.get("regenerate")  # type: ignore[assignment]
    new_questions: list[Question] = []
    if regen and shortfall:
        try:
            new_questions = regen(shortfall) or []
        except Exception:
            new_questions = []
    return {"questions": new_questions, "retries": state.get("retries", 0) + 1}


def build_quiz_review_graph():
    graph = StateGraph(QuizReviewState)
    graph.add_node("verify", _verify)
    graph.add_node("regenerate", _regenerate)
    graph.add_edge(START, "verify")
    graph.add_conditional_edges("verify", _decide, {"done": END, "regen": "regenerate"})
    graph.add_edge("regenerate", "verify")
    return graph.compile()


_QUIZ_REVIEW_GRAPH = None


def get_quiz_review_graph():
    global _QUIZ_REVIEW_GRAPH
    if _QUIZ_REVIEW_GRAPH is None:
        _QUIZ_REVIEW_GRAPH = build_quiz_review_graph()
    return _QUIZ_REVIEW_GRAPH


def review_quiz_questions(
    questions: list[Question],
    *,
    content_body: str,
    subtopic_title: str,
    regenerate: Callable[[int], list[Question]] | None = None,
) -> list[Question]:
    """Return only the questions that pass the examiner check (back-filled to the
    original count when a `regenerate` callback is available). Never returns an
    empty list if `questions` was non-empty — falls back to the originals."""
    if not questions:
        return questions
    result = get_quiz_review_graph().invoke(
        {
            "content": content_body,
            "subtopic_title": subtopic_title,
            "target_count": len(questions),
            "questions": list(questions),
            "valid": [],
            "retries": 0,
            "regenerate": regenerate,
        }
    )
    reviewed = result.get("valid", [])
    return reviewed[: len(questions)] if reviewed else list(questions)
