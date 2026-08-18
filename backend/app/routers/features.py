from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Stock, TechnicalFeature, Fundamental
from app.models.schemas import SyncResult
from app.services.feature_service import recompute_all_features
from app.services.fundamental_service import sync_all_fundamentals

router = APIRouter(prefix="/features", tags=["features"])


@router.get("/{symbol}/technical")
async def get_technical_features(symbol: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = result.scalar_one_or_none()
    if not stock and not symbol.endswith(".NS"):
        result = await db.execute(select(Stock).where(Stock.symbol == f"{symbol}.NS"))
        stock = result.scalar_one_or_none()
    if not stock:
        return {"error": f"Stock {symbol} not found"}

    tech_result = await db.execute(
        select(TechnicalFeature)
        .where(TechnicalFeature.stock_id == stock.id)
        .order_by(TechnicalFeature.date.desc())
        .limit(1)
    )
    tech = tech_result.scalar_one_or_none()
    if not tech:
        return {"error": "No technical features computed yet"}

    return {
        "symbol": stock.symbol,
        "date": str(tech.date),
        "sma_50": tech.sma_50,
        "sma_200": tech.sma_200,
        "ema_50": tech.ema_50,
        "ema_200": tech.ema_200,
        "rsi_14": tech.rsi_14,
        "macd": tech.macd,
        "macd_signal": tech.macd_signal,
        "atr_14": tech.atr_14,
        "volatility_30d": tech.volatility_30d,
        "volatility_90d": tech.volatility_90d,
        "beta": tech.beta,
        "max_drawdown_1y": tech.max_drawdown_1y,
        "sharpe_trailing": tech.sharpe_trailing,
        "momentum_12m": tech.momentum_12m,
    }


@router.get("/{symbol}/fundamental")
async def get_fundamental_features(symbol: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = result.scalar_one_or_none()
    if not stock and not symbol.endswith(".NS"):
        result = await db.execute(select(Stock).where(Stock.symbol == f"{symbol}.NS"))
        stock = result.scalar_one_or_none()
    if not stock:
        return {"error": f"Stock {symbol} not found"}

    fund_result = await db.execute(
        select(Fundamental)
        .where(Fundamental.stock_id == stock.id)
        .order_by(Fundamental.period_end.desc())
        .limit(1)
    )
    fund = fund_result.scalar_one_or_none()
    if not fund:
        return {"error": "No fundamental data available"}

    return {
        "symbol": stock.symbol,
        "period_end": str(fund.period_end),
        "trailing_pe": fund.trailing_pe,
        "price_to_book": fund.price_to_book,
        "ev_to_ebitda": fund.ev_to_ebitda,
        "dividend_yield": fund.dividend_yield,
        "roe": fund.roe,
        "roa": fund.roa,
        "debt_to_equity": fund.debt_to_equity,
        "gross_margin": fund.gross_margin,
        "operating_margin": fund.operating_margin,
        "net_margin": fund.net_margin,
        "eps": fund.eps,
        "revenue": fund.revenue,
        "market_cap_cr": stock.market_cap_cr,
    }


@router.post("/recompute-technical", response_model=SyncResult)
async def recompute_technical(
    limit: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        count = await recompute_all_features(db, limit=limit)
        return SyncResult(success=True, message=f"Computed technical features for {count} stocks", records_affected=count)
    except Exception as e:
        return SyncResult(success=False, message=f"Failed: {str(e)}")


@router.post("/recompute-fundamentals", response_model=SyncResult)
async def recompute_fundamentals(
    limit: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        count = await sync_all_fundamentals(db, limit=limit)
        return SyncResult(success=True, message=f"Synced fundamentals for {count} stocks", records_affected=count)
    except Exception as e:
        return SyncResult(success=False, message=f"Failed: {str(e)}")
