# app/config.py
import secrets
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_WEAK_SECRET_KEYS = {
    "change_this_to_a_secure_random_string_in_production",
    "inventory_management_secret_key_2025",
    "changeme",
    "",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "inventory_db"

    # Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — default mirrors server.py's previous fallback
    ALLOWED_ORIGINS: str = "http://localhost:8002,http://localhost:8081"

    # Email
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    ADMIN_EMAIL: str = ""
    NOTIFICATION_EMAIL: str = ""

    # Limits
    MAX_EXPORT_ROWS: int = 5000
    MAX_BACKUP_SIZE_MB: int = 500
    MAX_IMPORT_ROWS: int = 1000
    DASHBOARD_CACHE_TTL: int = 300

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()

if not settings.SECRET_KEY or settings.SECRET_KEY in _WEAK_SECRET_KEYS:
    raise RuntimeError(
        "\u26d4 CRITICAL: SECRET_KEY ist nicht gesetzt oder verwendet einen unsicheren Standardwert.\n"
        "Bitte einen sicheren Key in der .env setzen:\n"
        "  SECRET_KEY=" + secrets.token_hex(32) + "\n"
        "Server wird nicht gestartet."
    )