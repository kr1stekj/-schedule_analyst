"""Загрузка настроек из app/.env (URL БД, секрет JWT, CORS, путь к CSV)."""
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_APP_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _APP_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_APP_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    TOTP_CHALLENGE_EXPIRE_MINUTES: int = 5
    # через запятую, например: http://localhost:5173,http://127.0.0.1:5173
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ACTIVITIES_DATASET_PATH: Path = Field(
        default_factory=lambda: _REPO_ROOT
        / "datasets"
        / "activities_of_daily_living_large.csv"
    )


settings = Settings()