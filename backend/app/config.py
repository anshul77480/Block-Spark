"""Central configuration, loaded from environment / .env via python-dotenv."""
import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-prod")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # DB
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./insider_threat.db")

    # LLM
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "").strip()
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-4o-mini")

    # Chain
    RPC_URL: str = os.getenv("RPC_URL", "http://127.0.0.1:8545")
    CONTRACT_ADDRESS: str = os.getenv("CONTRACT_ADDRESS", "").strip()
    CONTRACT_ADDRESS_FILE: str = os.getenv(
        "CONTRACT_ADDRESS_FILE", "../blockchain/deployed_address.txt"
    )
    CHAIN_ENABLED: bool = _bool("CHAIN_ENABLED", "true")

    # Demo admin
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@bank.local")

    # Model artifact
    MODEL_PATH: str = os.getenv("MODEL_PATH", "iforest_model.joblib")


settings = Settings()
