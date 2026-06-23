from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Header

from app.core.config import get_settings
from app.core.errors import EduFXError


@dataclass(slots=True)
class TokenIdentity:
    email: str
    name: str
    subject: str


def parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise EduFXError("Missing Authorization header", status_code=401)
    if not authorization.startswith("Bearer "):
        raise EduFXError("Invalid Authorization header", status_code=401)
    return authorization.replace("Bearer ", "", 1).strip()


def verify_google_token(token: str) -> TokenIdentity:
    settings = get_settings()
    if token.startswith("demo:"):
        _, name, email = (token.split(":", 2) + ["", ""])[:3]
        return TokenIdentity(email=email or "student@edufx.demo", name=name or "Demo Student", subject=email or "demo")

    payload: dict[str, Any]
    if settings.supabase_jwt_secret:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    else:
        payload = jwt.decode(token, options={"verify_signature": False})

    email = str(payload.get("email") or payload.get("sub") or "student@edufx.demo")
    name = str(payload.get("name") or payload.get("user_metadata", {}).get("full_name") or email.split("@")[0].title())
    subject = str(payload.get("sub") or email)
    return TokenIdentity(email=email, name=name, subject=subject)


def auth_token_dependency(authorization: str | None = Header(default=None)) -> str:
    return parse_bearer_token(authorization)

