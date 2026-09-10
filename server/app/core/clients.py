from dataclasses import dataclass
from typing import Any

from supabase import Client, create_client

from app.core.config import Settings
from app.core.simple_supabase import SimpleSupabaseClient


@dataclass(slots=True)
class ExternalClients:
    supabase: Any | None = None
    vertex_model: str | None = None


def build_external_clients(settings: Settings) -> ExternalClients:
    supabase_client = None
    supabase_key = settings.supabase_service_role_key or settings.supabase_key

    if settings.supabase_url and supabase_key:
        if supabase_key.startswith("sb_secret_"):
            supabase_client = SimpleSupabaseClient(settings.supabase_url, supabase_key)
        else:
            supabase_client = create_client(settings.supabase_url, supabase_key)

    # Services historically call this field ``vertex_model``, but it is the
    # generation model hint for the shared provider chain. Keep AI features
    # enabled when Groq or Gemini is configured even if GCP is unavailable.
    vertex_model: str | None = None
    has_generation_provider = any(
        (
            settings.finetuned_model_url,
            settings.groq_api_key,
            settings.gemini_api_key,
            settings.vertex_ai_enabled and settings.google_cloud_project,
        )
    )
    if has_generation_provider:
        vertex_model = settings.vertex_model

    return ExternalClients(supabase=supabase_client, vertex_model=vertex_model)
