from dataclasses import dataclass

from supabase import Client, create_client

from app.core.config import Settings


@dataclass(slots=True)
class ExternalClients:
    supabase: Client | None = None
    gemini_api_key: str | None = None


def build_external_clients(settings: Settings) -> ExternalClients:
    supabase_client = None
    supabase_key = settings.supabase_service_role_key or settings.supabase_key

    if settings.supabase_url and supabase_key:
        supabase_client = create_client(settings.supabase_url, supabase_key)

    return ExternalClients(supabase=supabase_client, gemini_api_key=settings.gemini_api_key)
