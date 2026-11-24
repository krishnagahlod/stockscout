from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

import os
from loguru import logger

def _get_database_url() -> str:
    use_sqlite = getattr(settings, "USE_SQLITE", True) or os.getenv("USE_SQLITE", "").lower() in ("true", "1", "yes")
    if use_sqlite or not settings.DATABASE_URL:
        logger.info(f"Using SQLite database at {settings.DB_PATH}")
        return f"sqlite+aiosqlite:///{settings.DB_PATH}"

    if settings.DATABASE_URL.startswith("postgresql://"):
        return settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    return settings.DATABASE_URL

DATABASE_URL = _get_database_url()

engine = create_async_engine(
    DATABASE_URL, 
    echo=settings.DEBUG,
    connect_args={"prepared_statement_cache_size": 0} if "asyncpg" in DATABASE_URL else {}
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass

import app.models.db_models

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    """Create all tables and set WAL mode for SQLite."""
    async with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
