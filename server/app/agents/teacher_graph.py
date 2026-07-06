"""AI Teacher — a LangGraph supervisor graph over the student's dossier.

Flow:  route -> {analyst, diagnostician, coach}  -> synthesis -> ground -> END

- route picks which specialists run: for a report, all three (in parallel); for
  chat, a cheap LLM classification runs only the relevant one(s).
- each specialist is one grounded LLM call with a focused system prompt.
- synthesis writes the teacher-voice reply (chat) or report (report).
- ground (the grounding guard) removes any percentage the reply invented that
  isn't present in the dossier context, so the teacher can't hallucinate scores.

Read-only: nothing here touches scheduling. LLM calls go through
`ai_service.generate_text` (module-attribute access, so a single monkeypatch in
tests stubs every node).
"""
from __future__ import annotations

import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents import prompts
from app.services import ai_service

_ALL_SPECIALISTS = ("analyst", "diagnostician", "coach")


class TeacherState(TypedDict, total=False):
    context: str
    mode: str  # "chat" | "report"
    question: str
    history: str
    specialists: list[str]
    analyst_out: str
    diagnostician_out: str
    coach_out: str
    answer: str


def _specialist_prompt(system: str, context: str, question: str, history: str) -> str:
    parts = [system, "\n\nStudent data snapshot:\n", context]
    if history:
        parts.append("\n\nConversation so far:\n" + history)
    if question:
        parts.append("\n\nThe student's current question: " + question)
    return "".join(parts)


def _route(state: TeacherState) -> dict:
    if state.get("mode") == "report":
        return {"specialists": list(_ALL_SPECIALISTS)}
    question = state.get("question", "")
    raw = ai_service.generate_text(prompts.ROUTER_PROMPT + question, temperature=0.0, max_tokens=32)
    chosen = [label for label in _ALL_SPECIALISTS if label in raw.lower()]
    return {"specialists": chosen or list(_ALL_SPECIALISTS)}


def _run_specialist(state: TeacherState, key: str, system: str) -> dict:
    if key not in state.get("specialists", _ALL_SPECIALISTS):
        return {}
    prompt = _specialist_prompt(system, state.get("context", ""), state.get("question", ""), state.get("history", ""))
    return {f"{key}_out": ai_service.generate_text(prompt, temperature=0.3, max_tokens=400)}


def _analyst(state: TeacherState) -> dict:
    return _run_specialist(state, "analyst", prompts.ANALYST_PROMPT)


def _diagnostician(state: TeacherState) -> dict:
    return _run_specialist(state, "diagnostician", prompts.DIAGNOSTICIAN_PROMPT)


def _coach(state: TeacherState) -> dict:
    return _run_specialist(state, "coach", prompts.COACH_PROMPT)


def _synthesis(state: TeacherState) -> dict:
    notes = []
    if state.get("analyst_out"):
        notes.append("Progress notes:\n" + state["analyst_out"])
    if state.get("diagnostician_out"):
        notes.append("Weakness notes:\n" + state["diagnostician_out"])
    if state.get("coach_out"):
        notes.append("Improvement notes:\n" + state["coach_out"])
    notes_block = "\n\n".join(notes) if notes else "(no specialist notes available)"

    system = prompts.SYNTHESIS_REPORT_PROMPT if state.get("mode") == "report" else prompts.SYNTHESIS_CHAT_PROMPT
    parts = [system, "\n\nStudent data snapshot:\n", state.get("context", ""), "\n\nSpecialist notes:\n", notes_block]
    if state.get("history"):
        parts.append("\n\nConversation so far:\n" + state["history"])
    if state.get("question"):
        parts.append("\n\nThe student's question: " + state["question"])
    answer = ai_service.generate_text("".join(parts), temperature=0.4, max_tokens=700)
    return {"answer": answer}


_PERCENT = re.compile(r"\d+%")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _invented_percentages(answer: str, context: str) -> set[str]:
    """Percentages the reply mentions that don't appear in the dossier context."""
    return {token for token in _PERCENT.findall(answer) if token not in context}


def _ground(state: TeacherState) -> dict:
    answer = state.get("answer", "")
    context = state.get("context", "")
    invented = _invented_percentages(answer, context)
    if not invented:
        return {}

    # One corrective pass: tell the model exactly which figures were not in the data.
    correction = ai_service.generate_text(
        prompts._BASE
        + "You previously wrote a reply that included figures NOT present in the "
        f"student's data: {', '.join(sorted(invented))}. Rewrite it using ONLY "
        "figures that appear in the snapshot below; keep the same helpful tone.\n\n"
        "Snapshot:\n" + context + "\n\nYour previous reply:\n" + answer,
        temperature=0.2,
        max_tokens=700,
    )
    candidate = correction or answer

    # Hard guarantee: strip any sentence that still cites an invented figure.
    still_bad = _invented_percentages(candidate, context)
    if still_bad:
        kept = [s for s in _SENTENCE_SPLIT.split(candidate) if not any(tok in s for tok in still_bad)]
        candidate = " ".join(kept).strip()
    return {"answer": candidate}


def build_teacher_graph():
    graph = StateGraph(TeacherState)
    graph.add_node("route", _route)
    graph.add_node("analyst", _analyst)
    graph.add_node("diagnostician", _diagnostician)
    graph.add_node("coach", _coach)
    graph.add_node("synthesis", _synthesis)
    graph.add_node("ground", _ground)

    graph.add_edge(START, "route")
    # Fan out to all specialists; each no-ops if it wasn't selected for this run.
    for name in _ALL_SPECIALISTS:
        graph.add_edge("route", name)
        graph.add_edge(name, "synthesis")
    graph.add_edge("synthesis", "ground")
    graph.add_edge("ground", END)
    return graph.compile()


_TEACHER_GRAPH = None


def get_teacher_graph():
    global _TEACHER_GRAPH
    if _TEACHER_GRAPH is None:
        _TEACHER_GRAPH = build_teacher_graph()
    return _TEACHER_GRAPH
