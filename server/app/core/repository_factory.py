from __future__ import annotations

from dataclasses import dataclass

from app.core.clients import ExternalClients
from app.core.config import Settings
from app.core.store import demo_store
from app.repositories.auth_repository import AuthRepository
from app.repositories.behaviour_repository import BehaviourRepository
from app.repositories.content_repository import ContentRepository
from app.repositories.diagnostic_repository import DiagnosticRepository
from app.repositories.progress_repository import ProgressRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.results_repository import ResultsRepository
from app.repositories.scheduler_repository import SchedulerRepository
from app.repositories.supabase_auth_repository import SupabaseAuthRepository
from app.repositories.supabase_behaviour_repository import SupabaseBehaviourRepository
from app.repositories.supabase_content_repository import SupabaseContentRepository
from app.repositories.supabase_diagnostic_repository import SupabaseDiagnosticRepository
from app.repositories.supabase_progress_repository import SupabaseProgressRepository
from app.repositories.supabase_quiz_repository import SupabaseQuizRepository
from app.repositories.supabase_results_repository import SupabaseResultsRepository
from app.repositories.supabase_scheduler_repository import SupabaseSchedulerRepository


@dataclass(slots=True)
class RepositoryBundle:
    auth_repository: object
    diagnostic_repository: object
    scheduler_repository: object
    content_repository: object
    quiz_repository: object
    results_repository: object
    progress_repository: object
    behaviour_repository: object
    backend_name: str


def build_repository_bundle(settings: Settings, clients: ExternalClients) -> RepositoryBundle:
    if settings.data_backend == "supabase" and clients.supabase is not None:
        client = clients.supabase
        return RepositoryBundle(
            auth_repository=SupabaseAuthRepository(client),
            diagnostic_repository=SupabaseDiagnosticRepository(client),
            scheduler_repository=SupabaseSchedulerRepository(client),
            content_repository=SupabaseContentRepository(client),
            quiz_repository=SupabaseQuizRepository(client),
            results_repository=SupabaseResultsRepository(client),
            progress_repository=SupabaseProgressRepository(client),
            behaviour_repository=SupabaseBehaviourRepository(client),
            backend_name="supabase",
        )

    return RepositoryBundle(
        auth_repository=AuthRepository(demo_store),
        diagnostic_repository=DiagnosticRepository(demo_store),
        scheduler_repository=SchedulerRepository(demo_store),
        content_repository=ContentRepository(demo_store),
        quiz_repository=QuizRepository(demo_store),
        results_repository=ResultsRepository(demo_store),
        progress_repository=ProgressRepository(demo_store),
        behaviour_repository=BehaviourRepository(demo_store),
        backend_name="memory",
    )
