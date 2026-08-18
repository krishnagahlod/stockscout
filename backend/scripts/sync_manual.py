import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import async_session
from app.models.db_models import Stock
from app.services.data_service import sync_prices_for_stock
from app.services.fundamental_service import sync_fundamentals_for_stock
from loguru import logger

async def sync_selected():
    symbols = ["IOC.NS", "BAJAJ-AUTO.NS", "TECHM.NS", "ALKEM.NS", "ADANIGREEN.NS", "HINDUNILVR.NS"]
    async with async_session() as db:
        for symbol in symbols:
            result = await db.execute(select(Stock).where(Stock.symbol == symbol))
            stock = result.scalar_one_or_none()
            if stock:
                logger.info(f"Syncing {stock.symbol}...")
                try:
                    await sync_prices_for_stock(db, stock)
                    await sync_fundamentals_for_stock(db, stock)
                    logger.info(f"Finished syncing {stock.symbol}")
                except Exception as e:
                    logger.error(f"Failed {stock.symbol}: {e}")

if __name__ == "__main__":
    asyncio.run(sync_selected())
