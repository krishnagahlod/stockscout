import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import async_session
from sqlalchemy import text

async def fix_sequence():
    async with async_session() as db:
        await db.execute(text("SELECT setval('daily_prices_id_seq', COALESCE((SELECT MAX(id) + 1 FROM daily_prices), 1), false);"))
        await db.execute(text("SELECT setval('stock_fundamentals_id_seq', COALESCE((SELECT MAX(id) + 1 FROM stock_fundamentals), 1), false);"))
        await db.execute(text("SELECT setval('technical_features_id_seq', COALESCE((SELECT MAX(id) + 1 FROM technical_features), 1), false);"))
        await db.commit()
        print('Sequences updated!')

if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(fix_sequence())
