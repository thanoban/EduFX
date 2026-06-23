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
from app.core.store import demo_store
from app.repositories.auth_repository import AuthRepository
from app.repositories.behaviour_repository import BehaviourRepository
from app.repositories.content_repository import ContentRepository
from app.repositories.diagnostic_repository import DiagnosticRepository
from app.repositories.progress_repository import ProgressRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository
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

    auth_repository = AuthRepository(demo_store)
    diagnostic_repository = DiagnosticRepository(demo_store)
    scheduler_repository = SchedulerRepository(demo_store)
    content_repository = ContentRepository(demo_store)
    quiz_repository = QuizRepository(demo_store)
    results_repository = ResultsRepository(demo_store)
    progress_repository = ProgressRepository(demo_store)
    behaviour_repository = BehaviourRepository(demo_store)

    auth_service = AuthService(auth_repository)
    diagnostic_service = DiagnosticService(diagnostic_repository)
    scheduler_service = SchedulerService(scheduler_repository)
    content_service = ContentService(content_repository)
    quiz_service = QuizService(quiz_repository, content_repository, results_repository)
    results_service = ResultsService(results_repository, quiz_repository, behaviour_repository)
    explanation_service = ExplanationService(results_repository, clients.groq)
    progress_service = ProgressService(progress_repository)
    behaviour_service = BehaviourService(behaviour_repository)

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

