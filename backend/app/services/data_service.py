import csv
import asyncio
import time
import threading
from datetime import datetime, date
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf
from loguru import logger
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models.db_models import Stock, DailyPrice, SchedulerLog

NIFTY500_CSV_PATH = Path(__file__).parent / "nifty500_tickers.csv"


# --- In-memory sync progress tracker ---
class SyncProgress:
    def __init__(self):
        self.is_running = False
        self.current_stock = ""
        self.completed = 0
        self.total = 0
        self.total_records = 0
        self.errors: list[str] = []
        self.last_message = ""

    def reset(self, total: int):
        self.is_running = True
        self.current_stock = ""
        self.completed = 0
        self.total = total
        self.total_records = 0
        self.errors = []
        self.last_message = f"Starting sync for {total} stocks..."

    def finish(self, message: str):
        self.is_running = False
        self.last_message = message

    def to_dict(self):
        return {
            "is_running": self.is_running,
            "current_stock": self.current_stock,
            "completed": self.completed,
            "total": self.total,
            "total_records": self.total_records,
            "errors": self.errors[-5:],  # last 5 errors only
            "last_message": self.last_message,
            "progress_pct": round(self.completed / self.total * 100, 1) if self.total > 0 else 0,
        }


sync_progress = SyncProgress()


# --- Query helpers ---
async def get_stock_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Stock.id)))
    return result.scalar() or 0


async def get_price_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(DailyPrice.id)))
    return result.scalar() or 0


async def get_last_sync_time(db: AsyncSession, job_name: str) -> Optional[str]:
    result = await db.execute(
        select(SchedulerLog.completed_at)
        .where(SchedulerLog.job_name == job_name, SchedulerLog.status == "completed")
        .order_by(SchedulerLog.completed_at.desc())
        .limit(1)
    )
    row = result.scalar()
    return row.isoformat() if row else None


# --- Universe sync ---
async def sync_universe_from_csv(db: AsyncSession) -> int:
    """Load Nifty 500 tickers from the static CSV fallback file."""
    if not NIFTY500_CSV_PATH.exists():
        raise FileNotFoundError(f"Nifty 500 CSV not found at {NIFTY500_CSV_PATH}")

    count = 0
    with open(NIFTY500_CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            symbol = row["symbol"].strip()
            if not symbol.endswith(".NS"):
                symbol = f"{symbol}.NS"

            existing = await db.execute(select(Stock).where(Stock.symbol == symbol))
            stock = existing.scalar_one_or_none()

            if stock:
                stock.name = row.get("name", stock.name)
                stock.sector = row.get("sector", stock.sector)
                stock.industry = row.get("industry", stock.industry)
                stock.last_updated = datetime.utcnow()
            else:
                stock = Stock(
                    symbol=symbol,
                    name=row.get("name", symbol.replace(".NS", "")),
                    sector=row.get("sector"),
                    industry=row.get("industry"),
                    is_nifty500=True,
                    last_updated=datetime.utcnow(),
                )
                db.add(stock)
            count += 1

    await db.commit()

    log = SchedulerLog(
        job_name="sync_universe",
        status="completed",
        message=f"Synced {count} tickers from CSV",
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )
    db.add(log)
    await db.commit()

    return count


# --- Price fetching ---
def fetch_prices_yfinance(symbol: str, start: str, end: str) -> pd.DataFrame:
    """Fetch OHLCV for a single ticker via yfinance. Runs synchronously."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start, end=end, auto_adjust=False)

    if df.empty:
        return pd.DataFrame()

    df = df.reset_index()
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]

    # Ensure expected columns exist
    for col in ["adj_close", "stock_splits", "dividends"]:
        if col not in df.columns:
            df[col] = 0

    return df


async def sync_prices_for_stock(
    db: AsyncSession,
    stock: Stock,
    start_date: str = None,
    end_date: str = None,
) -> int:
    """Fetch and upsert prices for a single stock. Returns number of rows upserted."""
    if not start_date:
        latest = await db.execute(
            select(DailyPrice.date)
            .where(DailyPrice.stock_id == stock.id)
            .order_by(DailyPrice.date.desc())
            .limit(1)
        )
        latest_date = latest.scalar_one_or_none()
        if latest_date:
            from datetime import timedelta
            start_date = (latest_date + timedelta(days=1)).strftime("%Y-%m-%d")
        else:
            start_date = settings.PRICE_SYNC_START_DATE

    end_date = end_date or datetime.now().strftime("%Y-%m-%d")

    # If start_date is > end_date, we're already up to date
    if start_date > end_date:
        return 0

    try:
        df = fetch_prices_yfinance(stock.symbol, start_date, end_date)
    except Exception as e:
        logger.error(f"Failed to fetch prices for {stock.symbol}: {e}")
        return 0

    if df.empty:
        logger.warning(f"No price data for {stock.symbol}")
        return 0

    count = 0
    for _, row in df.iterrows():
        price_date = row["date"]
        if isinstance(price_date, pd.Timestamp):
            price_date = price_date.date()

        existing = await db.execute(
            select(DailyPrice).where(
                DailyPrice.stock_id == stock.id,
                DailyPrice.date == price_date,
            )
        )
        price_row = existing.scalar_one_or_none()

        if price_row:
            price_row.open = float(row.get("open", 0))
            price_row.high = float(row.get("high", 0))
            price_row.low = float(row.get("low", 0))
            price_row.close = float(row.get("close", 0))
            price_row.adj_close = float(row.get("adj_close", row.get("close", 0)))
            price_row.volume = int(row.get("volume", 0))
            price_row.dividends = float(row.get("dividends", 0))
            price_row.stock_splits = float(row.get("stock_splits", 0))
        else:
            price_row = DailyPrice(
                stock_id=stock.id,
                date=price_date,
                open=float(row.get("open", 0)),
                high=float(row.get("high", 0)),
                low=float(row.get("low", 0)),
                close=float(row.get("close", 0)),
                adj_close=float(row.get("adj_close", row.get("close", 0))),
                volume=int(row.get("volume", 0)),
                dividends=float(row.get("dividends", 0)),
                stock_splits=float(row.get("stock_splits", 0)),
            )
            db.add(price_row)
        count += 1

    await db.commit()
    stock.last_updated = datetime.utcnow()
    await db.commit()

    return count


async def sync_all_prices(db: AsyncSession, limit: Optional[int] = None) -> int:
    """Sync daily prices for all active stocks sequentially. Primarily used by the scheduler."""
    result = await db.execute(select(Stock).where(Stock.is_nifty500 == True))
    stocks = result.scalars().all()
    
    if limit:
        stocks = stocks[:limit]
        
    return await bulk_sync_historical_prices(db, stocks)


async def bulk_sync_historical_prices(db: AsyncSession, stocks: list[Stock], start_date: str = None) -> int:
    """Bulk download and upsert historical prices for a list of stocks using yfinance.download."""
    if not stocks:
        return 0

    if not start_date:
        # Find the latest date across all these stocks to avoid downloading too much redundant data
        latest = await db.execute(select(func.max(DailyPrice.date)))
        latest_date = latest.scalar_one_or_none()
        
        if latest_date:
            from datetime import timedelta
            # Start from the day after the latest date we have
            start_date = (latest_date + timedelta(days=1)).strftime("%Y-%m-%d")
            # If start_date is today, yfinance expects today's date to fetch today's data
            # but if start_date > today, we don't need to fetch.
            if start_date > datetime.now().strftime("%Y-%m-%d"):
                logger.info("All prices are up to date.")
                return 0
        else:
            start_date = settings.PRICE_SYNC_START_DATE

    symbols = [s.symbol for s in stocks]
    stock_map = {s.symbol: s.id for s in stocks}

    logger.info(f"Bulk downloading prices for {len(symbols)} symbols from {start_date}...")
    
    # Chunk symbols to avoid yfinance rate limits
    chunk_size = 100
    all_dfs = []
    
    import time
    for i in range(0, len(symbols), chunk_size):
        chunk = symbols[i:i + chunk_size]
        try:
            # Auto-adjust is False to match old behavior. group_by='ticker' to get MultiIndex columns.
            logger.info(f"Downloading chunk {i//chunk_size + 1} ({len(chunk)} symbols)...")
            df = yf.download(chunk, start=start_date, group_by="ticker", auto_adjust=False, threads=True)
            if not df.empty:
                # If only 1 symbol was passed in this chunk, yf returns single index columns.
                if len(chunk) == 1:
                    df.columns = pd.MultiIndex.from_product([[chunk[0]], df.columns])
                all_dfs.append(df)
            time.sleep(1) # Small delay to respect rate limits
        except Exception as e:
            logger.error(f"Failed bulk download for chunk {i}: {e}")

    if not all_dfs:
        logger.warning("No price data returned from bulk download.")
        return 0

    df = pd.concat(all_dfs, axis=1) if len(all_dfs) > 1 else all_dfs[0]
    # Stack the 'ticker' level (level 0) so the index becomes (Date, Ticker)
    stacked = df.stack(level=0, future_stack=True).reset_index()
    # Columns are now: Date, Ticker, Adj Close, Close, High, Low, Open, Volume
    # Rename columns to match db schema
    stacked.columns = [c.lower().replace(" ", "_") for c in stacked.columns]

    # Convert DataFrame to a list of dicts for bulk insert
    records = []
    for _, row in stacked.iterrows():
        # Skip rows where volume or close is missing (NaN)
        if pd.isna(row.get("close")) or pd.isna(row.get("volume")):
            continue

        sym = row["ticker"]
        stock_id = stock_map.get(sym)
        if not stock_id:
            continue

        price_date = row["date"]
        if isinstance(price_date, pd.Timestamp):
            price_date = price_date.date()
        elif isinstance(price_date, datetime):
            price_date = price_date.date()

        records.append({
            "stock_id": stock_id,
            "date": price_date,
            "open": float(row.get("open", 0)),
            "high": float(row.get("high", 0)),
            "low": float(row.get("low", 0)),
            "close": float(row.get("close", 0)),
            "adj_close": float(row.get("adj_close", row.get("close", 0))),
            "volume": int(row.get("volume", 0)),
            "dividends": 0.0, # yf.download doesn't easily expose dividends in this view without actions=True
            "stock_splits": 0.0,
        })

    if not records:
        logger.info("No valid records found in downloaded data.")
        return 0

    logger.info(f"Upserting {len(records)} price records...")

    from sqlalchemy.dialects.postgresql import insert as pg_insert
    
    # Chunk the records to avoid huge SQL statements
    chunk_size = 3000
    total_upserted = 0
    
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        stmt = pg_insert(DailyPrice).values(chunk)
        # On conflict (stock_id, date), update all values
        stmt = stmt.on_conflict_do_update(
            index_elements=["stock_id", "date"],
            set_={
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "adj_close": stmt.excluded.adj_close,
                "volume": stmt.excluded.volume,
            }
        )
        await db.execute(stmt)
        total_upserted += len(chunk)

    # Update last_updated timestamp on stocks
    update_stmt = (
        Stock.__table__.update()
        .where(Stock.id.in_([s.id for s in stocks]))
        .values(last_refreshed=datetime.utcnow())
    )
    await db.execute(update_stmt)
    await db.commit()
    
    logger.info(f"Successfully bulk upserted {total_upserted} records.")
    return total_upserted


# --- Background price sync ---
async def _run_price_sync(limit: Optional[int], start_date: Optional[str]):
    """Background task that syncs prices using its own DB session."""
    async with async_session() as db:
        try:
            result = await db.execute(select(Stock).where(Stock.is_nifty500 == True))
            stocks = result.scalars().all()

            if limit:
                stocks = stocks[:limit]

            sync_progress.reset(len(stocks))

            log = SchedulerLog(
                job_name="sync_prices",
                status="started",
                message=f"Syncing prices for {len(stocks)} stocks",
                started_at=datetime.utcnow(),
            )
            db.add(log)
            await db.commit()

            for i, stock in enumerate(stocks):
                sync_progress.current_stock = stock.symbol
                logger.info(f"[{i+1}/{len(stocks)}] Fetching prices for {stock.symbol}")

                try:
                    count = await sync_prices_for_stock(db, stock, start_date=start_date)
                    sync_progress.total_records += count
                except Exception as e:
                    error_msg = f"{stock.symbol}: {str(e)}"
                    sync_progress.errors.append(error_msg)
                    logger.error(f"Error syncing {stock.symbol}: {e}")
                    await db.rollback()

                sync_progress.completed = i + 1
                await asyncio.sleep(settings.YFINANCE_RATE_LIMIT_SECONDS)

            log.status = "completed"
            log.message = f"Synced {sync_progress.total_records} price records for {len(stocks)} stocks"
            log.completed_at = datetime.utcnow()
            await db.commit()

            sync_progress.finish(
                f"Completed: {sync_progress.total_records} records for {len(stocks)} stocks"
            )

        except Exception as e:
            logger.error(f"Background sync failed: {e}")
            sync_progress.finish(f"Failed: {str(e)}")


def start_price_sync_background(limit: Optional[int] = None, start_date: Optional[str] = None):
    """Kick off the price sync in a background thread with its own event loop."""
    if sync_progress.is_running:
        return False

    def _run():
        import asyncio
        asyncio.create_task(_run_price_sync(limit, start_date))
        
    _run()
    return True
