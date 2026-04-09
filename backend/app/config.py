from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Learning Map API"
    database_url: str = "postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/learning_map"

    openai_api_key: str = ""
    openai_base_url: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

    # Learning MD：本地 Markdown 根目录（相对 backend 工作目录或绝对路径）。未设置则使用 backend/docs_md。
    md_docs_root: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
