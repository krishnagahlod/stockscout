"""Dashboard API router — aggregated summary for the home page."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.models.db_models import (
    Stock, DailyPrice, Strategy, BacktestResult, Alert, TechnicalFeature, Fundamental,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Aggregated dashboard summary."""
    stock_count = (await db.execute(select(func.count(Stock.id)))).scalar() or 0
    price_count = (await db.execute(select(func.count(DailyPrice.id)))).scalar() or 0
    strategy_count = (await db.execute(select(func.count(Strategy.id)))).scalar() or 0
    backtest_count = (await db.execute(select(func.count(BacktestResult.id)))).scalar() or 0
    unread_alerts = (await db.execute(
        select(func.count(Alert.id)).where(Alert.is_read == False)
    )).scalar() or 0
    tech_count = (await db.execute(select(func.count(TechnicalFeature.id)))).scalar() or 0
    fund_count = (await db.execute(select(func.count(Fundamental.id)))).scalar() or 0

    # Unique stocks with data
    stocks_with_prices = (await db.execute(
        select(func.count(func.distinct(DailyPrice.stock_id)))
    )).scalar() or 0
    stocks_with_technicals = (await db.execute(
        select(func.count(func.distinct(TechnicalFeature.stock_id)))
    )).scalar() or 0
    stocks_with_fundamentals = (await db.execute(
        select(func.count(func.distinct(Fundamental.stock_id)))
    )).scalar() or 0

    # Latest backtest
    latest_bt = (await db.execute(
        select(BacktestResult).order_by(BacktestResult.run_date.desc()).limit(1)
    )).scalar_one_or_none()

    latest_bt_summary = None
    if latest_bt:
        strat = (await db.execute(
            select(Strategy).where(Strategy.id == latest_bt.strategy_id)
        )).scalar_one_or_none()
        latest_bt_summary = {
            "id": latest_bt.id,
            "strategy_name": strat.name if strat else "Unknown",
            "cagr": latest_bt.cagr,
            "sharpe": latest_bt.sharpe_ratio,
            "max_dd": latest_bt.max_drawdown,
            "run_date": str(latest_bt.run_date) if latest_bt.run_date else None,
        }

    return {
        "stock_count": stock_count,
        "price_count": price_count,
        "strategy_count": strategy_count,
        "backtest_count": backtest_count,
        "unread_alerts": unread_alerts,
        "technical_features_count": tech_count,
        "fundamental_count": fund_count,
        "stocks_with_prices": stocks_with_prices,
        "stocks_with_technicals": stocks_with_technicals,
        "stocks_with_fundamentals": stocks_with_fundamentals,
        "latest_backtest": latest_bt_summary,
    }
