"""Gemini API helpers for quiz generation and explanation."""
from __future__ import annotations

import json
from typing import Any

import httpx


def _gemini_post(api_key: str, model: str, prompt: str, max_tokens: int = 4096, temperature: float = 0.4) -> str:
    model_name = model.replace("models/", "")
    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
        params={"key": api_key},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        },
        timeout=60.0,
    )
    response.raise_for_status()
    payload = response.json()
    candidates = payload.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return " ".join(p.get("text", "") for p in parts).strip()


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        end = next((i for i, l in enumerate(lines[1:], 1) if l.strip() == "```"), len(lines))
        return "\n".join(lines[1:end]).strip()
    return text


def generate_quiz_questions(
    *,
    api_key: str,
    model: str,
    subtopic_title: str,
    group_name: str,
    level: str,
    content_body: str,
    context_chunks: list[str] | None = None,
    count: int = 15,
) -> list[dict[str, Any]]:
    """Call Gemini to generate MCQ questions. Returns [] on parse failure."""
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
        raw = _gemini_post(api_key, model, prompt, max_tokens=4096, temperature=0.4)
        cleaned = _strip_fences(raw)
        questions = json.loads(cleaned)
        if isinstance(questions, list):
            return questions[:count]
        return []
    except (httpx.HTTPError, json.JSONDecodeError, KeyError):
        return []
