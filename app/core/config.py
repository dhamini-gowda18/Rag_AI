from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore",
        protected_namespaces=(),
    )

    app_name: str = "FastAPI AI RAG Assignment"
    app_version: str = "1.0.0"
    debug: bool = False
    api_prefix: str = "/api"

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/ragdb"
    )

    jwt_secret_key: str = Field(default="change-me-in-production")
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_token_expire_minutes: int = 60 * 24

    # Gemini
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-flash-latest")

    upload_dir: str = str(BASE_DIR / "uploads")
    storage_dir: str = str(BASE_DIR / "storage")
    vector_index_path: str = str(BASE_DIR / "storage" / "faiss.index")
    vector_metadata_path: str = str(BASE_DIR / "storage" / "faiss_meta.json")

    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()