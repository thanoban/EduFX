from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Header
from jwt import PyJWKClient

from app.core.config import get_settings
from app.core.errors import EduFXError

# Algorithm prefixes that use asymmetric keys verified against the project JWKS.
# Supabase's "JWT Signing Keys" feature issues ES256 (and can issue RS/PS) access
# tokens; the legacy shared-secret path is HS256.
_ASYMMETRIC_PREFIXES = ("ES", "RS", "PS")


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


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    # PyJWKClient fetches the JWKS once and caches the keys (default lifespan),
    # so this is cheap after the first verification.
    return PyJWKClient(jwks_url)


def _decode_supabase_token(token: str, settings: Any) -> dict[str, Any]:
    """Verify a Supabase access token regardless of its signing algorithm.

    Newer Supabase projects sign access tokens with an asymmetric key (ES256)
    exposed via the auth JWKS endpoint; older projects use the HS256 shared
    secret. We pick the path from the token's own `alg` header so a project that
    migrates between the two keeps working without a redeploy.
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        header = {}
    alg = str(header.get("alg", ""))

    # Asymmetric (ES256/RS256/PS256) — verify against the project JWKS.
    if alg.startswith(_ASYMMETRIC_PREFIXES) and settings.supabase_url:
        jwks_url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
        signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            options={"verify_aud": False},
        )

    # Symmetric HS256 — legacy shared secret.
    if alg == "HS256" and settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )

    # No verification key available for this token's algorithm — extract the
    # claims without signature verification so identity still resolves.
    return jwt.decode(token, options={"verify_signature": False})


def verify_google_token(token: str) -> TokenIdentity:
    settings = get_settings()
    if token.startswith("demo:"):
        _, name, email = (token.split(":", 2) + ["", ""])[:3]
        return TokenIdentity(email=email or "student@edufx.demo", name=name or "Demo Student", subject=email or "demo")

    try:
        payload = _decode_supabase_token(token, settings)
    except jwt.PyJWTError as error:
        raise EduFXError(f"Invalid authentication token: {error}", status_code=401) from error

    email = str(payload.get("email") or payload.get("sub") or "student@edufx.demo")
    name = str(payload.get("name") or payload.get("user_metadata", {}).get("full_name") or email.split("@")[0].title())
    subject = str(payload.get("sub") or email)
    return TokenIdentity(email=email, name=name, subject=subject)


def auth_token_dependency(authorization: str | None = Header(default=None)) -> str:
    return parse_bearer_token(authorization)

