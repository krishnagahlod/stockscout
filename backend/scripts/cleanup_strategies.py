import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from app.core.database import async_session
from app.models.db_models import Strategy

async def cleanup_strategies():
    print("Starting strategy cleanup...")
    async with async_session() as session:
        result = await session.execute(select(Strategy))
        strategies = result.scalars().all()
        deleted = 0
        for s in strategies:
            if s.rules_json and "filters" in s.rules_json:
                filters = s.rules_json["filters"]
                if not isinstance(filters, list):
                    print(f"Deleting malformed strategy {s.id}: {s.name}")
                    await session.execute(delete(Strategy).where(Strategy.id == s.id))
                    deleted += 1
        
        await session.commit()
        print(f"Cleanup complete. Deleted {deleted} strategies.")

if __name__ == "__main__":
    asyncio.run(cleanup_strategies())
