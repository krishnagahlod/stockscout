import asyncio
import os
import sys

# Add backend to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS scheduler_logs (
                id SERIAL PRIMARY KEY,
                job_name TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                started_at TIMESTAMP,
                completed_at TIMESTAMP
            );
            """)
        )
    print("Table created.")

if __name__ == "__main__":
    asyncio.run(main())
