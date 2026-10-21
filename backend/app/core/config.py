from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Paragon HR Recruitment Automation"
    DATABASE_URL: str = "postgresql+psycopg://hr:hr@db:5432/hr"

    JWT_SECRET: str = "change-me"
    JWT_EXPIRE_MINUTES: int = 720
    COOKIE_SECURE: bool = False

    PUBLIC_APP_URL: str = "http://localhost:3000"
    UPLOAD_DIR: str = "/data/uploads"
    MAX_UPLOAD_MB: int = 10

    ADMIN_EMAIL: str = "admin@paragon.local"
    ADMIN_PASSWORD: str = "ChangeMe123!"
    ADMIN_NAME: str = "Hamza"
    SEED_DEMO_USERS: bool = True
    DEMO_PASSWORD: str = "ChangeMe123!"

    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-5"

    GOOGLE_SYNC_ENABLED: bool = False
    GOOGLE_SERVICE_ACCOUNT_FILE: str = "/secrets/google-service-account.json"
    GOOGLE_SPREADSHEET_ID: str = ""
    GOOGLE_DRIVE_ROOT_FOLDER_ID: str = ""
    GOOGLE_CALENDAR_ID: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    WEBHOOK_SECRET: str = ""

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "cvs"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
