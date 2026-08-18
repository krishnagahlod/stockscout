import asyncio
from app.core.database import async_session
from app.services.feature_service import recompute_all_features

async def main():
    async with async_session() as db:
        count = await recompute_all_features(db)
        print(f"SUCCESS: Recomputed technical features for {count} stocks")

if __name__ == "__main__":
    asyncio.run(main())
