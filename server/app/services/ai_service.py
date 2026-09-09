"""AI provider helpers for quiz generation and explanation.

Text providers are tried in the configured ``AI_PROVIDER_ORDER``. Production
can therefore prefer Groq and disable Vertex without changing application code.
Every candidate is isolated so an unset key, rate limit, or provider outage
never blocks the next configured provider:

    quiz generation: self-hosted fine-tuned endpoint (the actual coursework
                      fine-tune, e.g. hosted on Modal's free GPU credit tier)
                      -> configured provider order
    explanations:     configured provider order
    generate_text:    configured provider order
"""
from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterator
from typing import Any


logger = logging.getLogger(__name__)


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        end = next((i for i, ln in enumerate(lines[1:], 1) if ln.strip() == "```"), len(lines))
        return "\n".join(lines[1:end]).strip()
    return text


def _gemini_generate_config(temperature: float, max_tokens: int):
    """Shared GenerateContentConfig for both Vertex and API-key Gemini calls.

    `thinking_budget=0` disables Gemini 2.5's internal "thinking" tokens —
    without this, the model can spend most (or all) of `max_tokens` on
    invisible reasoning before writing any of the actual answer, so a 15-
    question JSON quiz gets silently cut off mid-string well before hitting
    a sensible token budget. This task is deterministic structured output
    with no need for chain-of-thought, so thinking is pure waste here.
    """
    from google.genai import types

    return types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )


def _call_vertex(model_name: str, prompt: str, temperature: float, max_tokens: int) -> str:
    from google import genai

    from app.core.config import get_settings

    settings = get_settings()
    if not settings.vertex_ai_enabled or not settings.google_cloud_project:
        return ""

    client = genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
    )
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=_gemini_generate_config(temperature, max_tokens),
    )
    return response.text or ""


def _call_gemini_api_key(model_name: str, prompt: str, temperature: float, max_tokens: int) -> str:
    """Call the same Gemini model via a free Google AI Studio API key (not Vertex).

    Uses the same `google-genai` SDK as `_call_vertex` — only the client
    construction differs, so this needs no new dependency and behaves
    identically once a real response comes back.
    """
    from google import genai

    from app.core.config import get_settings

    settings = get_settings()
    if not settings.gemini_api_key:
        return ""

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=_gemini_generate_config(temperature, max_tokens),
    )
    return response.text or ""


def _call_openai_compatible(
    base_url: str,
    api_key: str | None,
    model: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
    max_output_tokens_cap: int | None = None,
    timeout_seconds: float = 60.0,
) -> str:
    """Call any OpenAI-chat-compatible `/v1/chat/completions` endpoint.

    Shared by the self-hosted fine-tuned vLLM box (no `api_key`) and Groq
    (`api_key` required) — both speak the identical request/response shape.
    `max_output_tokens_cap` is only set for small-context endpoints (the
    fine-tuned box's 4096-token window); Groq's models have much larger
    windows so that caller passes `None`.
    """
    import httpx

    base_url = base_url.rstrip("/")
    output_budget = min(max_tokens, max_output_tokens_cap) if max_output_tokens_cap else max_tokens
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    for attempt in range(2):
        response = httpx.post(
            f"{base_url}/v1/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": output_budget,
            },
            timeout=timeout_seconds,
        )
        if response.status_code == 400 and "context length" in response.text.lower():
            # Prompt + requested output exceeded the window: shrink the output
            # budget once and retry, otherwise let the caller fall back.
            output_budget = output_budget // 2
            if attempt == 0 and output_budget >= 256:
                continue
            return ""
        response.raise_for_status()
        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        return str(message.get("content") or "")
    return ""


# The self-hosted fine-tuned model (Qwen2.5-7B) serves only a 4096-token
# context window — that ceiling covers prompt + completion combined. Capping
# the output here leaves room for the prompt; without it, requesting 4096
# output tokens overflows the window and every call 400s.
_FINETUNED_MAX_OUTPUT_TOKENS = 2048


def _call_finetuned(prompt: str, temperature: float, max_tokens: int) -> str:
    """Call an optional self-hosted vLLM OpenAI-compatible endpoint.

    This is the actual coursework fine-tune (Qwen2.5-7B + LoRA adapter),
    tried first when configured — e.g. hosted on Modal's free GPU credit
    tier (see docs/finetune-modal-hosting-guide.md). Intentionally optional:
    when `FINETUNED_MODEL_URL` is unset, this is a no-op so callers fall
    through to Gemini/Groq/Vertex.
    """
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.finetuned_model_url:
        return ""

    return _call_openai_compatible(
        settings.finetuned_model_url,
        api_key=None,
        model=settings.finetuned_model_name,
        prompt=prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        max_output_tokens_cap=_FINETUNED_MAX_OUTPUT_TOKENS,
    )


def _call_groq(prompt: str, temperature: float, max_tokens: int) -> str:
    """Call Groq's free OpenAI-compatible endpoint. No-op if unset."""
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.groq_api_key:
        return ""

    return _call_openai_compatible(
        settings.groq_base_url,
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        prompt=prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout_seconds=settings.groq_timeout_seconds,
    )


def _provider_order() -> tuple[str, ...]:
    """Return a validated, de-duplicated text-provider order."""
    from app.core.config import get_settings

    supported = {"groq", "gemini", "vertex"}
    providers: list[str] = []
    for raw_name in get_settings().ai_provider_order.split(","):
        name = raw_name.strip().lower()
        if name in supported and name not in providers:
            providers.append(name)
    return tuple(providers) or ("vertex", "gemini", "groq")


def _text_candidates(
    vertex_model: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> Iterator[tuple[str, Callable[[], str]]]:
    calls = {
        "groq": lambda: _call_groq(prompt, temperature, max_tokens),
        "gemini": lambda: _call_gemini_api_key(vertex_model, prompt, temperature, max_tokens),
        "vertex": lambda: _call_vertex(vertex_model, prompt, temperature, max_tokens),
    }
    for provider in _provider_order():
        yield provider, calls[provider]


def _first_text_response(
    vertex_model: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    for provider, call in _text_candidates(vertex_model, prompt, temperature, max_tokens):
        try:
            text = call()
        except Exception as exc:
            logger.warning("AI provider %s failed: %s", provider, exc)
            continue
        if text and text.strip():
            return text.strip()
    return ""


def generate_text(prompt: str, *, temperature: float = 0.3, max_tokens: int = 1024) -> str:
    """Generic single-shot text generation over the shared provider fallback.

    Used by the LangGraph agent nodes (AI teacher, quiz self-check). The
    fine-tuned box is skipped because its adapter was trained only for quiz
    generation. Returns "" if every configured provider is unavailable.
    """
    from app.core.config import get_settings

    model = get_settings().vertex_model
    return _first_text_response(model, prompt, temperature, max_tokens)


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
    """Generate MCQ questions. Returns [] on any failure.

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
            "When a question targets one of the weak concepts above, set its `concept` field to "
            "that exact slug. Use the remaining questions for broader topic coverage.\n\n"
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
        "concept (a short lowercase hyphenated slug naming the single idea the question tests, "
        "e.g. ionisation-energy-trend or reaction-with-water).\n"
        "Output raw JSON array only. No markdown, no explanation, no extra text."
    )

    # Each candidate is parsed independently: if one returns text that is not
    # valid JSON (or is unavailable), we fall through to the next rather than
    # failing the whole request.
    for raw in _quiz_raw_candidates(vertex_model, prompt):
        if not raw:
            continue
        try:
            questions = json.loads(_strip_fences(raw))
        except Exception:
            continue
        if isinstance(questions, list) and questions:
            return questions[:count]
    return []


def _quiz_raw_candidates(vertex_model: str, prompt: str):
    """Yield raw model responses to try in order.

    The self-hosted fine-tuned endpoint (the actual coursework fine-tune) is
    tried first when configured — that's the graded artifact, not a provider
    fallback. After that, providers follow ``AI_PROVIDER_ORDER``. Each
    candidate is independently wrapped so a failure never blocks the next.
    """
    candidates: tuple[tuple[str, Callable[[], str]], ...] = (
        ("finetuned", lambda: _call_finetuned(prompt, temperature=0.4, max_tokens=4096)),
        *_text_candidates(vertex_model, prompt, temperature=0.4, max_tokens=4096),
    )
    for provider, call in candidates:
        try:
            yield call()
        except Exception as exc:
            logger.warning("AI provider %s failed: %s", provider, exc)
            continue


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
    """Generate a wrong-answer explanation. Returns None if every provider fails."""
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

    # The fine-tune was only trained for quiz generation (see
    # docs/finetune-method.md), so explanations skip that rung.
    text = _first_text_response(vertex_model, prompt, temperature=0.2, max_tokens=180)
    return text or None
