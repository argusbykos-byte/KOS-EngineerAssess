# Config module
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "KOS-EngineerAssess"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite+aiosqlite:///./kos_assess.db"
    KIMI_API_URL: str = "http://localhost:8080/v1/chat/completions"
    UPLOAD_DIR: str = "uploads"
    SECRET_KEY: str = "kos-engineer-assess-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()

# Role configuration exports
from app.config.roles import (
    ENGINEERING_ROLES,
    CATEGORY_PROMPTS,
    get_role_config,
    get_all_roles,
    get_role_categories,
    get_role_skill_dimensions,
    get_category_prompt,
)

__all__ = [
    "settings",
    "Settings",
    "ENGINEERING_ROLES",
    "CATEGORY_PROMPTS",
    "get_role_config",
    "get_all_roles",
    "get_role_categories",
    "get_role_skill_dimensions",
    "get_category_prompt",
]
