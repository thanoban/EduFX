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
    count: int = 15,
) -> list[dict[str, Any]]:
    """Generate MCQ questions via Vertex AI. Returns [] on any failure."""
    rag_section = ""
    if context_chunks:
        rag_section = "Additional relevant context:\n" + "\n---\n".join(context_chunks) + "\n\n"

    prompt = (
        f"You are an A-Level Chemistry examiner.\n"
        f"Topic: {subtopic_title}. Block: {group_name}. Student level: {level}.\n\n"
        f"Notes:\n{content_body}\n\n"
        f"{rag_section}"
        f"Generate exactly {count} multiple-choice A-Level chemistry questions as a JSON array.\n"
        "Each object must have exactly these keys: "
        "question_text, option_a, option_b, option_c, option_d, "
        "correct_answer (value: A, B, C, or D), difficulty (value: easy, medium, or hard).\n"
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
