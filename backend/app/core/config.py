import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # stock-ai-tool root
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    APP_NAME: str = "AI Investment Co-Pilot"
    DEBUG: bool = False

    # Database
    DB_PATH: str = str(DATA_DIR / "stock_ai.db")
    DATABASE_URL: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    API_SECRET_KEY: str = ""
    RESEND_API_KEY: str = ""

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    DEFAULT_ALERT_EMAIL: str = ""

    # Cerebras LLM

    CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
    CEREBRAS_MODEL: str = "gpt-oss-120b"

    # yfinance
    PRICE_SYNC_START_DATE: str = "2015-01-01"
    YFINANCE_RATE_LIMIT_SECONDS: float = 0.5

    # Backtest defaults
    DEFAULT_TX_COST_BPS: float = 20.0
    DEFAULT_SLIPPAGE_BPS: float = 10.0
    RISK_FREE_RATE: float = 0.06  # Indian govt bond ~6%

    # Scheduler
    SCHEDULER_ENABLED: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
