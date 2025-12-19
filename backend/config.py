import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
CHROMA_DIR.mkdir(exist_ok=True)


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = f"sqlite:///{DATA_DIR}/klyra.db"

    # JWT
    SECRET_KEY: str = "klyra-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # RAG settings
    CHUNK_SIZE: int = 1000  # Larger chunks keep related content together
    CHUNK_OVERLAP: int = 100  # More overlap to avoid splitting context
    TOP_K_RESULTS: int = 8  # Retrieve more chunks for comprehensive answers

    class Config:
        env_file = ".env"


settings = Settings()
