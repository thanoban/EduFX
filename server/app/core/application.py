from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.routes.auth import router as auth_router
from app.routes.behaviour import router as behaviour_router
from app.routes.content import router as content_router
from app.routes.diagnostic import router as diagnostic_router
from app.routes.explanation import router as explanation_router
from app.routes.progress import router as progress_router
from app.routes.quiz import router as quiz_router
from app.routes.results import router as results_router
from app.routes.scheduler import router as scheduler_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

    _cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    if settings.frontend_origin and settings.frontend_origin not in _cors_origins:
        _cors_origins.append(settings.frontend_origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_origin_regex=r"https://.*\.run\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(diagnostic_router, prefix="/diagnostic", tags=["diagnostic"])
    app.include_router(scheduler_router, prefix="/scheduler", tags=["scheduler"])
    app.include_router(content_router, prefix="/content", tags=["content"])
    app.include_router(quiz_router, prefix="/quiz", tags=["quiz"])
    app.include_router(results_router, prefix="/results", tags=["results"])
    app.include_router(explanation_router, prefix="/explanation", tags=["explanation"])
    app.include_router(progress_router, prefix="/progress", tags=["progress"])
    app.include_router(behaviour_router, prefix="/behaviour", tags=["behaviour"])

    @app.get("/")
    def health() -> dict[str, str]:
        return {"message": "EduFX MVC API is running"}

    return app

