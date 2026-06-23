from dataclasses import dataclass
from functools import lru_cache

from app.controllers.auth_controller import AuthController
from app.controllers.behaviour_controller import BehaviourController
from app.controllers.content_controller import ContentController
from app.controllers.diagnostic_controller import DiagnosticController
from app.controllers.explanation_controller import ExplanationController
from app.controllers.progress_controller import ProgressController
from app.controllers.quiz_controller import QuizController
from app.controllers.results_controller import ResultsController
from app.controllers.scheduler_controller import SchedulerController
from app.core.clients import build_external_clients
from app.core.config import get_settings
from app.core.repository_factory import build_repository_bundle
from app.services.auth_service import AuthService
from app.services.behaviour_service import BehaviourService
from app.services.content_service import ContentService
from app.services.diagnostic_service import DiagnosticService
from app.services.explanation_service import ExplanationService
from app.services.progress_service import ProgressService
from app.services.quiz_service import QuizService
from app.services.results_service import ResultsService
from app.services.scheduler_service import SchedulerService


@dataclass(slots=True)
class AppContainer:
    auth_controller: AuthController
    diagnostic_controller: DiagnosticController
    scheduler_controller: SchedulerController
    content_controller: ContentController
    quiz_controller: QuizController
    results_controller: ResultsController
    explanation_controller: ExplanationController
    progress_controller: ProgressController
    behaviour_controller: BehaviourController


@lru_cache
def get_container() -> AppContainer:
    settings = get_settings()
    clients = build_external_clients(settings)
    repositories = build_repository_bundle(settings, clients)

    auth_service = AuthService(repositories.auth_repository)
    diagnostic_service = DiagnosticService(repositories.diagnostic_repository)
    scheduler_service = SchedulerService(repositories.scheduler_repository)
    content_service = ContentService(repositories.content_repository)
    quiz_service = QuizService(
        repositories.quiz_repository,
        repositories.content_repository,
        repositories.results_repository,
    )
    results_service = ResultsService(
        repositories.results_repository,
        repositories.quiz_repository,
        repositories.behaviour_repository,
    )
    explanation_service = ExplanationService(repositories.results_repository, clients.groq)
    progress_service = ProgressService(repositories.progress_repository)
    behaviour_service = BehaviourService(repositories.behaviour_repository)

    return AppContainer(
        auth_controller=AuthController(auth_service),
        diagnostic_controller=DiagnosticController(diagnostic_service),
        scheduler_controller=SchedulerController(scheduler_service),
        content_controller=ContentController(content_service),
        quiz_controller=QuizController(quiz_service),
        results_controller=ResultsController(results_service),
        explanation_controller=ExplanationController(explanation_service),
        progress_controller=ProgressController(progress_service),
        behaviour_controller=BehaviourController(behaviour_service),
    )
