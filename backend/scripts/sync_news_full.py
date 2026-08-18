import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session
from app.services.news_service import sync_all_news

async def run_news():
    print('Starting fast background news sync for all Nifty 500 stocks...')
    async with async_session() as db:
        count = await sync_all_news(db, limit=None)
        print(f'Done! Total news synced: {count}')

if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_news())
