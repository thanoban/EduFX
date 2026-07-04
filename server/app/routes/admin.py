from fastapi import APIRouter, Depends, Header

from app.core.auth import parse_bearer_token, verify_google_token
from app.core.container import get_container
from app.core.errors import EduFXError
from app.models.dto import SetStudentRoleRequest

router = APIRouter()


def require_admin(authorization: str | None = Header(default=None), container=Depends(get_container)) -> None:
    token = parse_bearer_token(authorization)
    identity = verify_google_token(token)
    if not container.auth_service.is_admin(identity.email):
        raise EduFXError("Admin access required", status_code=403)


@router.get("/students", dependencies=[Depends(require_admin)])
def all_students(container=Depends(get_container)):
    return container.admin_controller.all_students()


@router.get("/students/{student_id}", dependencies=[Depends(require_admin)])
def student_detail(student_id: int, container=Depends(get_container)):
    return container.admin_controller.student_detail(student_id)


@router.patch("/students/{student_id}/role", dependencies=[Depends(require_admin)])
def set_student_role(student_id: int, body: SetStudentRoleRequest, container=Depends(get_container)):
    return container.admin_controller.set_student_role(student_id, body.role)
