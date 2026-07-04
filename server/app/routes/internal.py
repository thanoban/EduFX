from fastapi import APIRouter, Depends, Header

from app.core.config import get_settings
from app.core.container import get_container
from app.core.errors import EduFXError

router = APIRouter()


def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.reminders_shared_secret:
        # No secret configured (local dev) — allow, matching the rest of the
        # backend's "works out of the box locally" defaults.
        return
    if x_internal_secret != settings.reminders_shared_secret:
        raise EduFXError("Invalid internal secret", status_code=403)


@router.post("/reminders/run", dependencies=[Depends(require_internal_secret)])
def run_reminders(container=Depends(get_container)):
    return container.reminder_controller.run_daily_scan()
