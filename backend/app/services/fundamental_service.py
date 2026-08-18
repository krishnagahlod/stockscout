"""Fetch and compute fundamental data from yfinance."""

import math
from datetime import datetime, date
from typing import Optional

import yfinance as yf
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, Fundamental


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return None


def _pct_to_decimal(val: Optional[float]) -> Optional[float]:
    """Convert a percentage value to decimal (e.g. 4.39 → 0.0439).

    yfinance returns dividendYield ALWAYS as a percentage:
    4.39 means 4.39%, 0.97 means 0.97%. Always divide by 100.
    """
    if val is None:
        return None
    return val / 100


def fetch_fundamentals_yfinance(symbol: str) -> dict:
    """Fetch fundamentals from yfinance .info for a single ticker."""
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    # yfinance returns dividendYield as percentage (4.39 = 4.39%) — always divide by 100
    # ROE, margins etc. are already decimals (0.32 = 32%)
    raw_div_yield = _safe_float(info.get("dividendYield"))
    raw_debt_equity = _safe_float(info.get("debtToEquity"))
    
    # yfinance debtToEquity is often in percentage format (e.g. 36.65 means 36.65%)
    if raw_debt_equity is not None:
        raw_debt_equity = raw_debt_equity / 100.0

    roe = _safe_float(info.get("returnOnEquity"))
    
    shares = _safe_float(info.get("sharesOutstanding"))
    bv = _safe_float(info.get("bookValue"))
    total_debt = _safe_float(info.get("totalDebt"))
    net_income = _safe_float(info.get("netIncomeToCommon"))
    
    if shares is not None and bv is not None and shares > 0 and bv > 0:
        total_equity = shares * bv
        if raw_debt_equity is None and total_debt is not None:
            raw_debt_equity = total_debt / total_equity
        if roe is None and net_income is not None:
            roe = net_income / total_equity

    return {
        "pe": _safe_float(info.get("trailingPE")),
        "pb": _safe_float(info.get("priceToBook")),
        "ebitda": _safe_float(info.get("ebitda")),
        "dividend_yield": _pct_to_decimal(raw_div_yield),
        "roe": roe,
        "roce": roe, # Note: ROCE often not provided by yfinance, using ROE as fallback or could leave empty
        "debt_to_equity": raw_debt_equity,
        "revenue": _safe_float(info.get("totalRevenue")),
        "net_income": _safe_float(info.get("netIncomeToCommon")),
        "eps": _safe_float(info.get("trailingEps")),
        "free_cash_flow": _safe_float(info.get("freeCashflow")),
        "gross_margin": _safe_float(info.get("grossMargins")),
        "operating_margin": _safe_float(info.get("operatingMargins")),
        "net_margin": _safe_float(info.get("profitMargins")),
        "beta": _safe_float(info.get("beta")),
        "avg_volume_20d": _safe_float(info.get("averageVolume")),
        "week_52_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        "week_52_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "market_cap": _safe_float(
            info.get("marketCap", 0) / 1e7 if info.get("marketCap") else None
        ),
    }


async def sync_fundamentals_for_stock(db: AsyncSession, stock: Stock) -> bool:
    """Fetch and upsert fundamentals for a single stock."""
    import asyncio
    try:
        # yfinance HTTP calls are synchronous and blocking, must run in thread
        data = await asyncio.to_thread(fetch_fundamentals_yfinance, stock.symbol)
    except Exception as e:
        logger.error(f"Failed to fetch fundamentals for {stock.symbol}: {e}")
        return False

    today = date.today()

    existing = await db.execute(
        select(Fundamental).where(
            Fundamental.stock_id == stock.id,
            Fundamental.as_of_date == today,
        )
    )
    fund = existing.scalar_one_or_none()

    if fund:
        for key, val in data.items():
            if key == "market_cap":
                fund.market_cap = val
                if val is not None:
                    stock.market_cap_cr = val
                continue
            if hasattr(fund, key):
                setattr(fund, key, val)
    else:
        fund = Fundamental(
            stock_id=stock.id,
            as_of_date=today,
            **{k: v for k, v in data.items() if k != "market_cap"},
        )
        db.add(fund)
        if "market_cap" in data and data["market_cap"] is not None:
            fund.market_cap = data["market_cap"]
            stock.market_cap_cr = data["market_cap"]

    await db.commit()
    return True


async def sync_all_fundamentals(db_dummy: AsyncSession, limit: Optional[int] = None) -> int:
    """Sync fundamentals for all stocks. Returns count of successful syncs."""
    # We use db_dummy just for compatibility, but we spawn separate sessions for concurrency
    from app.core.database import async_session
    import asyncio
    from app.core.config import settings

    async with async_session() as db:
        result = await db.execute(select(Stock).where(Stock.is_nifty500 == True))
        stocks = result.scalars().all()
    
    if limit:
        stocks = stocks[:limit]

    sem = asyncio.Semaphore(10)  # Max 10 concurrent requests
    
    async def _sync_single(stock: Stock):
        async with sem:
            logger.info(f"Fetching fundamentals for {stock.symbol}")
            # Each task needs its own db session to avoid concurrent transaction errors
            async with async_session() as session:
                ok = await sync_fundamentals_for_stock(session, stock)
                # Exponential backoff/sleep to respect rate limits inside the semaphore
                await asyncio.sleep(settings.YFINANCE_RATE_LIMIT_SECONDS)
                return ok

    tasks = [_sync_single(stock) for stock in stocks]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    count = sum(1 for r in results if r is True)
    return count
