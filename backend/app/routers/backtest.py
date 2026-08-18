"""Backtest API router — run backtests and retrieve results."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import BacktestResult, Strategy
from app.models.backtest_schemas import (
    BacktestRequest,
    BacktestResponse,
    BacktestMetrics,
    EquityCurvePoint,
    TradeRecord,
    MonthlyReturn,
    HoldingSnapshot,
)
from app.services.backtest_service import run_backtest

router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.post("/run", response_model=BacktestResponse)
async def run_backtest_endpoint(
    request: BacktestRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run a portfolio backtest for a given strategy."""
    try:
        result = await run_backtest(request, db)
        return result
    except ValueError as e:
        logger.error(f"Backtest ValueError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Backtest execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/results/{result_id}", response_model=BacktestResponse)
async def get_backtest_result(result_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve a stored backtest result by ID."""
    result = await db.execute(
        select(BacktestResult).where(BacktestResult.id == result_id)
    )
    bt = result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=404, detail="Backtest result not found")

    # Load strategy name
    strat_result = await db.execute(select(Strategy).where(Strategy.id == bt.strategy_id))
    strategy = strat_result.scalar_one_or_none()

    return _bt_to_response(bt, strategy)


@router.get("/results", response_model=list[BacktestResponse])
async def list_backtest_results(
    strategy_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List backtest results, optionally filtered by strategy."""
    query = select(BacktestResult).order_by(desc(BacktestResult.run_date)).limit(limit)
    if strategy_id:
        query = query.where(BacktestResult.strategy_id == strategy_id)

    result = await db.execute(query)
    rows = result.scalars().all()

    # Load strategies
    strat_ids = {r.strategy_id for r in rows if r.strategy_id is not None}
    strat_map = {}
    if strat_ids:
        strat_result = await db.execute(select(Strategy).where(Strategy.id.in_(strat_ids)))
        strat_map = {s.id: s for s in strat_result.scalars().all()}

    return [_bt_to_response(r, strat_map.get(r.strategy_id)) for r in rows]


def _bt_to_response(bt: BacktestResult, strategy: Optional[Strategy] = None) -> BacktestResponse:
    """Convert a DB BacktestResult to API response."""
    equity_curve = bt.equity_curve_json if isinstance(bt.equity_curve_json, list) else (json.loads(bt.equity_curve_json) if bt.equity_curve_json else [])
    trades = bt.trade_log_json if isinstance(bt.trade_log_json, list) else (json.loads(bt.trade_log_json) if bt.trade_log_json else [])
    monthly = bt.monthly_returns_json if isinstance(bt.monthly_returns_json, list) else (json.loads(bt.monthly_returns_json) if bt.monthly_returns_json else [])
    holdings = bt.holdings_json if isinstance(bt.holdings_json, list) else (json.loads(bt.holdings_json) if bt.holdings_json else [])

    return BacktestResponse(
        id=bt.id,
        strategy_id=bt.strategy_id,
        strategy_name=strategy.name if strategy else f"Strategy #{bt.strategy_id}",
        start_date=str(bt.start_date),
        end_date=str(bt.end_date),
        initial_capital=bt.initial_capital,
        final_value=bt.final_value or bt.initial_capital,
        metrics=BacktestMetrics(
            cagr=bt.cagr,
            total_return=bt.total_return,
            sharpe_ratio=bt.sharpe_ratio,
            sortino_ratio=bt.sortino_ratio,
            calmar_ratio=bt.calmar_ratio,
            max_drawdown=bt.max_drawdown,
            volatility=bt.volatility,
            win_rate=bt.win_rate,
            total_trades=bt.total_trades or 0,
            benchmark_cagr=bt.benchmark_return,
        ),
        equity_curve=[EquityCurvePoint(**p) for p in equity_curve],
        trades=[TradeRecord(**t) for t in trades],
        monthly_returns=[MonthlyReturn(**m) for m in monthly],
        holdings=[HoldingSnapshot(**h) for h in holdings],
        created_at=bt.run_date,
    )
