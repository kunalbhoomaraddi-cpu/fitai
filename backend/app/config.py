"""Environment-based configuration. All secrets come from environment variables / .env."""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "FitAI"
    environment: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"

    # Database: SQLite locally, PostgreSQL in production (postgresql+psycopg://user:pass@host/db)
    database_url: str = "sqlite:///./fitai.db"

    # Auth
    jwt_secret: str = "change-me-in-.env-this-is-only-for-local-dev"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # CORS (comma separated)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"

    # AI provider: auto | gemini | groq | mock
    ai_provider: Literal["auto", "gemini", "groq", "mock"] = "auto"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_model: str = "gemini-3.5-flash-lite"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    ai_timeout_seconds: float = 45.0
    ai_max_retries: int = 2
    ai_requests_per_minute: int = 20  # per-user limit on AI endpoints
    auth_requests_per_minute: int = 20  # per-IP limit on login/register/code checks

    # Email verification (free: Gmail SMTP with an App Password, or any SMTP provider)
    email_verification_required: bool = True
    login_otp_required: bool = True  # email a 6-digit code on every login
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    verification_code_minutes: int = 15

    # External APIs
    enable_external_apis: bool = True
    off_base_url: str = "https://world.openfoodfacts.org"
    off_user_agent: str = "FitAI/1.0 (local development; https://github.com/your-org/fitai)"
    wger_base_url: str = "https://wger.de/api/v2"
    external_timeout_seconds: float = 6.0

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_username and self.smtp_password)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
