"""Thin transactional-email wrapper (Resend).

Deliberately tiny and safe-by-default: with no RESEND_API_KEY configured (the
default for local dev and tests), send_email logs the message instead of
calling out to Resend, so nothing breaks and no accidental email goes out
without an explicit key. Swappable to a different provider by rewriting only
this file — nothing else in the codebase talks to Resend's API directly.
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("edufx.email")

_RESEND_ENDPOINT = "https://api.resend.com/emails"


def send_email(to: str, subject: str, body: str) -> bool:
    """Send one plain-text email. Returns True if actually sent (or logged in
    the no-key dev path), False if the provider call failed."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.info("[email:noop] to=%s subject=%r body=%r", to, subject, body)
        return True

    try:
        response = httpx.post(
            _RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resend_from_email,
                "to": [to],
                "subject": subject,
                "text": body,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        logger.exception("Failed to send reminder email to %s", to)
        return False
