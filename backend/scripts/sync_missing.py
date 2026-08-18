import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session
from app.services.fundamental_service import sync_all_fundamentals
from app.services.feature_service import recompute_all_features
from app.models.db_models import Stock
from sqlalchemy import select

async def sync_missing():
    print("Starting fast fundamental & feature sync...")
    async with async_session() as db:
        res = await db.execute(select(Stock).where(Stock.is_nifty500 == True))
        stocks = res.scalars().all()
        
        print(f"Syncing fundamentals for {len(stocks)} stocks...")
        await sync_all_fundamentals(db)
        
        print(f"Recomputing features for {len(stocks)} stocks...")
        await recompute_all_features(db)
        
    print("Done!")

if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(sync_missing())
