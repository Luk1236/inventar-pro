# app/config.py
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "inventory_db"
    
    # Security
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:8000,http://localhost:8081"
    
    # Email
    SMTP_SERVER: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    ADMIN_EMAIL: str = ""
    NOTIFICATION_EMAIL: str = ""
    
    # Limits
    MAX_EXPORT_ROWS: int = 5000
    MAX_BACKUP_SIZE_MB: int = 500
    MAX_IMPORT_ROWS: int = 1000
    DASHBOARD_CACHE_TTL: int = 30
    
    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

settings = Settings()