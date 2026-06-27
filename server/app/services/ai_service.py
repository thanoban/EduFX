"""Vertex AI (Gemini) helpers for quiz generation and explanation."""
from __future__ import annotations

import json
from typing import Any


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        end = next((i for i, ln in enumerate(lines[1:], 1) if ln.strip() == "```"), len(lines))
        return "\n".join(lines[1:end]).strip()
    return text


def _call_vertex(model_name: str, prompt: str, temperature: float, max_tokens: int) -> str:
    from google import genai
    from google.genai import types

    from app.core.config import get_settings

    settings = get_settings()
    if not settings.google_cloud_project:
        return ""

    client = genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
    )
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text or ""


def generate_quiz_questions(
    *,
    vertex_model: str,
    subtopic_title: str,
    group_name: str,
    level: str,
    content_body: str,
    context_chunks: list[str] | None = None,
    weak_concepts: list[dict[str, Any]] | None = None,
    count: int = 15,
) -> list[dict[str, Any]]:
    """Generate MCQ questions via Vertex AI. Returns [] on any failure.

    Difficulty is matched to the student's `level` and, when `weak_concepts` are
    supplied, the bulk of the quiz reinforces the concepts the student got wrong
    (reworded — not repeats) so generation is personalized rather than generic.
    """
    from app.core.rules import level_difficulty_spread

    rag_section = ""
    if context_chunks:
        rag_section = "Additional relevant context:\n" + "\n---\n".join(context_chunks) + "\n\n"

    spread = level_difficulty_spread(level, total=count)

    weak_section = ""
    if weak_concepts:
        focus_count = round(count * 0.65)
        lines = []
        for item in weak_concepts[:6]:
            sample = item.get("sample_question")
            sample_text = f" (e.g. missed: \"{sample}\")" if sample else ""
            lines.append(f"- {item['concept']}{sample_text}")
        weak_section = (
            f"This student previously answered questions on these concepts incorrectly:\n"
            + "\n".join(lines)
            + f"\n\nMake about {focus_count} of the {count} questions reinforce these weak concepts "
            "with NEW wording and different angles (do not copy the missed questions). "
            "Use the remaining questions for broader topic coverage.\n\n"
        )

    prompt = (
        f"You are an A-Level Chemistry examiner.\n"
        f"Topic: {subtopic_title}. Block: {group_name}. Student level: {level}.\n\n"
        f"Notes:\n{content_body}\n\n"
        f"{rag_section}"
        f"{weak_section}"
        f"Generate exactly {count} multiple-choice A-Level chemistry questions as a JSON array.\n"
        f"The {count} questions must include exactly {spread['easy']} easy, {spread['medium']} medium, "
        f"and {spread['hard']} hard questions, in any order.\n"
        "Each object must have exactly these keys: "
        "question_text, option_a, option_b, option_c, option_d, "
        "correct_answer (value: A, B, C, or D), difficulty (value: easy, medium, or hard), "
        "concept (a short 2-4 word lowercase tag for the specific idea the question tests, "
        "e.g. 'ionisation energy trend').\n"
        "Output raw JSON array only. No markdown, no explanation, no extra text."
    )

    try:
        raw = _call_vertex(vertex_model, prompt, temperature=0.4, max_tokens=4096)
        cleaned = _strip_fences(raw)
        questions = json.loads(cleaned)
        if isinstance(questions, list):
            return questions[:count]
        return []
    except Exception:
        return []


def generate_explanation(
    *,
    vertex_model: str,
    level: str,
    question_text: str,
    option_a: str,
    option_b: str,
    option_c: str,
    option_d: str,
    student_answer: str,
    correct_answer: str,
    context_chunks: list[str] | None = None,
) -> str | None:
    """Generate a wrong-answer explanation. Returns None on failure."""
    rag_section = ""
    if context_chunks:
        rag_section = "Relevant notes:\n" + "\n---\n".join(context_chunks) + "\n\n"

    prompt = (
        "You are an A-Level Chemistry teacher explaining a wrong answer.\n"
        f"Student level: {level}\n"
        f"{rag_section}"
        f"Question: {question_text}\n"
        f"Options: A={option_a}; B={option_b}; C={option_c}; D={option_d}\n"
        f"Student answered: {student_answer}\n"
        f"Correct answer: {correct_answer}\n"
        "Explain why the correct answer is right and why the student's choice is wrong. "
        "Use plain text only. Maximum 3 sentences."
    )

    try:
        text = _call_vertex(vertex_model, prompt, temperature=0.2, max_tokens=180)
        return text.strip() or None
    except Exception:
        return None
