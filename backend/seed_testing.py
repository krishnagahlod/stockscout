import asyncio
import yfinance as yf
from datetime import datetime

from app.core.database import async_session
from app.services.data_service import sync_prices_for_stock
from app.services.fundamental_service import sync_fundamentals_for_stock
from app.models.db_models import Stock
from sqlalchemy import select

async def seed_test_stocks():
    symbols = ["TCS.NS", "SBIN.NS", "RELIANCE.NS", "INFY.NS", "HDFCBANK.NS"]
    
    async with async_session() as db:
        for sym in symbols:
            # Upsert Stock
            existing = await db.execute(select(Stock).where(Stock.symbol == sym))
            stock = existing.scalar_one_or_none()
            if not stock:
                stock = Stock(
                    symbol=sym,
                    name=sym.replace(".NS", ""),
                    is_nifty500=True,
                    last_updated=datetime.utcnow()
                )
                db.add(stock)
                await db.commit()
                await db.refresh(stock)
            
            print(f"Syncing fundamentals for {sym}...")
            await sync_fundamentals_for_stock(db, stock)
            print(f"Fundamentals synced for {sym}.")

if __name__ == "__main__":
    asyncio.run(seed_test_stocks())
