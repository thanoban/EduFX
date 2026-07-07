from dataclasses import dataclass
from functools import lru_cache

from app.controllers.admin_controller import AdminController
from app.controllers.auth_controller import AuthController
from app.controllers.behaviour_controller import BehaviourController
from app.controllers.content_controller import ContentController
from app.controllers.diagnostic_controller import DiagnosticController
from app.controllers.explanation_controller import ExplanationController
from app.controllers.progress_controller import ProgressController
from app.controllers.quiz_controller import QuizController
from app.controllers.reminder_controller import ReminderController
from app.controllers.results_controller import ResultsController
from app.controllers.scheduler_controller import SchedulerController
from app.controllers.settings_controller import SettingsController
from app.controllers.teacher_controller import TeacherController
from app.core.clients import build_external_clients
from app.core.config import get_settings
from app.core.repository_factory import build_repository_bundle
from app.ml.recommender_engine import RecommenderEngine
from app.repositories.rag_repository import RagRepository
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService
from app.services.behaviour_service import BehaviourService
from app.services.content_service import ContentService
from app.services.diagnostic_service import DiagnosticService
from app.services.explanation_service import ExplanationService
from app.services.progress_service import ProgressService
from app.services.quiz_service import QuizService
from app.services.reminder_service import ReminderService
from app.services.results_service import ResultsService
from app.services.scheduling_agent import SchedulingAgent
from app.services.settings_service import SettingsService
from app.services.teacher_service import TeacherService


@dataclass(slots=True)
class AppContainer:
    auth_service: AuthService
    auth_controller: AuthController
    diagnostic_controller: DiagnosticController
    scheduler_controller: SchedulerController
    content_controller: ContentController
    quiz_controller: QuizController
    results_controller: ResultsController
    explanation_controller: ExplanationController
    progress_controller: ProgressController
    behaviour_controller: BehaviourController
    admin_controller: AdminController
    settings_controller: SettingsController
    reminder_controller: ReminderController
    teacher_controller: TeacherController


@lru_cache
def get_container() -> AppContainer:
    settings = get_settings()
    clients = build_external_clients(settings)
    repositories = build_repository_bundle(settings, clients)

    rag_repository = RagRepository(clients.supabase)

    auth_service = AuthService(repositories.auth_repository)
    diagnostic_service = DiagnosticService(repositories.diagnostic_repository)
    recommender_engine = RecommenderEngine(
        repositories.scheduler_repository,
        repositories.progress_repository,
        repositories.results_repository,
    )
    scheduling_agent = SchedulingAgent(
        recommender_engine,
        repositories.results_repository,
    )
    content_service = ContentService(repositories.content_repository, scheduling_agent)
    quiz_service = QuizService(
        repositories.quiz_repository,
        repositories.content_repository,
        repositories.results_repository,
        scheduling_agent,
        rag_repository=rag_repository,
        vertex_model=clients.vertex_model,
    )
    results_service = ResultsService(
        repositories.results_repository,
        repositories.quiz_repository,
        repositories.behaviour_repository,
        scheduling_agent,
    )
    explanation_service = ExplanationService(
        repositories.results_repository,
        rag_repository=rag_repository,
        vertex_model=clients.vertex_model,
    )
    progress_service = ProgressService(repositories.progress_repository)
    behaviour_service = BehaviourService(repositories.behaviour_repository)
    admin_service = AdminService(repositories.admin_repository)
    settings_service = SettingsService(repositories.auth_repository)
    reminder_service = ReminderService(repositories.admin_repository)
    teacher_service = TeacherService(
        repositories.results_repository,
        repositories.progress_repository,
        repositories.scheduler_repository,
        repositories.quiz_repository,
        recommender_engine,
    )

    return AppContainer(
        auth_service=auth_service,
        auth_controller=AuthController(auth_service),
        diagnostic_controller=DiagnosticController(diagnostic_service),
        scheduler_controller=SchedulerController(scheduling_agent),
        content_controller=ContentController(content_service),
        quiz_controller=QuizController(quiz_service),
        results_controller=ResultsController(results_service),
        explanation_controller=ExplanationController(explanation_service),
        progress_controller=ProgressController(progress_service),
        behaviour_controller=BehaviourController(behaviour_service),
        admin_controller=AdminController(admin_service),
        settings_controller=SettingsController(settings_service),
        reminder_controller=ReminderController(reminder_service),
        teacher_controller=TeacherController(teacher_service),
    )
