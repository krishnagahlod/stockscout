import asyncio
import sys
sys.path.append('.')
from app.core.database import async_session
from app.models.db_models import Stock
from sqlalchemy import select

async def run():
    db = async_session()
    search_term = "%icici ban%"
    res = await db.execute(select(Stock).where(Stock.name.ilike(search_term)))
    print([r.name for r in res.scalars()])
    await db.close()

if __name__ == '__main__':
    asyncio.run(run())
