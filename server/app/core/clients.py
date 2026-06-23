from dataclasses import dataclass

from groq import Groq
from supabase import Client, create_client

from app.core.config import Settings


@dataclass(slots=True)
class ExternalClients:
    supabase: Client | None = None
    groq: Groq | None = None


def build_external_clients(settings: Settings) -> ExternalClients:
    supabase_client = None
    groq_client = None

    if settings.supabase_url and settings.supabase_key:
        supabase_client = create_client(settings.supabase_url, settings.supabase_key)

    if settings.groq_api_key:
        groq_client = Groq(api_key=settings.groq_api_key)

    return ExternalClients(supabase=supabase_client, groq=groq_client)

