from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EduFX MVC API"
    environment: str = "development"
    api_prefix: str = ""
    frontend_origin: str = "http://localhost:3000"
    supabase_url: str | None = None
    supabase_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    google_cloud_project: str | None = None
    google_cloud_location: str = "global"
    vertex_model: str = "gemini-2.5-flash"
    demo_mode: bool = True
    response_message_default: str = "Request completed"
    data_backend: str = Field(default="memory", pattern="^(memory|supabase)$")

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
