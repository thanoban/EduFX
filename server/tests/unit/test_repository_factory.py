from app.core.clients import ExternalClients
from app.core.config import Settings
from app.core.repository_factory import build_repository_bundle
from app.repositories.auth_repository import AuthRepository
from app.repositories.supabase_auth_repository import SupabaseAuthRepository


class FakeSupabaseClient:
    pass


def test_repository_factory_uses_memory_backend_without_supabase_client():
    settings = Settings(data_backend="supabase")
    repositories = build_repository_bundle(settings, ExternalClients(supabase=None))
    assert repositories.backend_name == "memory"
    assert isinstance(repositories.auth_repository, AuthRepository)


def test_repository_factory_uses_supabase_backend_when_enabled_and_available():
    settings = Settings(data_backend="supabase")
    repositories = build_repository_bundle(
        settings,
        ExternalClients(supabase=FakeSupabaseClient()),  # type: ignore[arg-type]
    )
    assert repositories.backend_name == "supabase"
    assert isinstance(repositories.auth_repository, SupabaseAuthRepository)
