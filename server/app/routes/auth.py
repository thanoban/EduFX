from fastapi import APIRouter, Depends, Header

from app.core.auth import auth_token_dependency
from app.core.container import get_container
from app.core.request_auth import assert_student_access, require_authenticated_request

router = APIRouter()


@router.post("/google")
def login(
    token: str = Depends(auth_token_dependency),
    container=Depends(get_container),
):
    return container.auth_controller.login(token)


@router.get("/check")
def check(
    student_id: int = Header(alias="X-Student-Id"),
    current=Depends(require_authenticated_request),
    container=Depends(get_container),
):
    assert_student_access(current, student_id)
    return container.auth_controller.check(student_id)
