from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header

from app.core.auth import TokenIdentity, parse_bearer_token, verify_google_token
from app.core.config import get_settings
from app.core.container import get_container
from app.core.errors import EduFXError


@dataclass(frozen=True, slots=True)
class AuthenticatedRequest:
    identity: TokenIdentity | None
    student_id: int | None


def require_authenticated_request(
    authorization: str | None = Header(default=None),
    container=Depends(get_container),
) -> AuthenticatedRequest:
    """Authenticate API requests in deployed mode.

    The memory backend remains usable for local tests and the demo store. A
    Supabase-backed deployment must present the same Supabase access token that
    was used during login, and that token must belong to a known student.
    """
    settings = get_settings()
    if not authorization and settings.data_backend == "memory":
        return AuthenticatedRequest(identity=None, student_id=None)

    token = parse_bearer_token(authorization)
    identity = verify_google_token(token)
    student = container.auth_service.get_student_by_email(identity.email)
    if student is None:
        raise EduFXError("Authenticated student not found", status_code=401)
    return AuthenticatedRequest(identity=identity, student_id=student.id)


def require_student_access(
    student_id: int,
    current: AuthenticatedRequest = Depends(require_authenticated_request),
) -> AuthenticatedRequest:
    if current.student_id is not None and current.student_id != student_id:
        raise EduFXError("You can only access your own student data", status_code=403)
    return current


def assert_student_access(current: AuthenticatedRequest, student_id: int) -> None:
    if current.student_id is not None and current.student_id != student_id:
        raise EduFXError("You can only access your own student data", status_code=403)
