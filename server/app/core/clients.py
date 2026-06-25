from dataclasses import dataclass

from supabase import Client, create_client

from app.core.config import Settings


@dataclass(slots=True)
class ExternalClients:
    supabase: Client | None = None
    vertex_model: str | None = None


def build_external_clients(settings: Settings) -> ExternalClients:
    supabase_client = None
    supabase_key = settings.supabase_service_role_key or settings.supabase_key

    if settings.supabase_url and supabase_key:
        supabase_client = create_client(settings.supabase_url, supabase_key)

    vertex_model: str | None = None
    if settings.google_cloud_project:
        vertex_model = settings.vertex_model

    return ExternalClients(supabase=supabase_client, vertex_model=vertex_model)
