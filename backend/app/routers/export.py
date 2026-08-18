"""Export API router — CSV download for backtest results."""

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import BacktestResult, Strategy

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/backtest/{result_id}/csv")
async def export_backtest_csv(result_id: int, db: AsyncSession = Depends(get_db)):
    """Export backtest trades as CSV."""
    result = await db.execute(select(BacktestResult).where(BacktestResult.id == result_id))
    bt = result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=404, detail="Backtest not found")

    strat = (await db.execute(
        select(Strategy).where(Strategy.id == bt.strategy_id)
    )).scalar_one_or_none()

    trades = json.loads(bt.trade_log_json) if bt.trade_log_json else []

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["Backtest Export"])
    writer.writerow(["Strategy", strat.name if strat else "Unknown"])
    writer.writerow(["Period", f"{bt.start_date} to {bt.end_date}"])
    writer.writerow(["Initial Capital", bt.initial_capital])
    writer.writerow(["Final Value", bt.final_value])
    writer.writerow(["CAGR", f"{(bt.cagr or 0) * 100:.2f}%"])
    writer.writerow(["Sharpe", f"{bt.sharpe_ratio or 0:.2f}"])
    writer.writerow(["Max Drawdown", f"{(bt.max_drawdown or 0) * 100:.2f}%"])
    writer.writerow([])

    # Trade log
    writer.writerow(["Date", "Action", "Symbol", "Name", "Shares", "Price", "Value", "Reason"])
    for t in trades:
        writer.writerow([
            t.get("date", ""),
            t.get("action", ""),
            t.get("symbol", ""),
            t.get("name", ""),
            t.get("shares", ""),
            t.get("price", ""),
            t.get("value", ""),
            t.get("reason", ""),
        ])

    output.seek(0)
    filename = f"backtest_{result_id}_{strat.name if strat else 'export'}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/backtest/{result_id}/equity-csv")
async def export_equity_csv(result_id: int, db: AsyncSession = Depends(get_db)):
    """Export equity curve as CSV."""
    result = await db.execute(select(BacktestResult).where(BacktestResult.id == result_id))
    bt = result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=404, detail="Backtest not found")

    equity = json.loads(bt.equity_curve_json) if bt.equity_curve_json else []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Portfolio Value", "Benchmark Value", "Drawdown"])
    for p in equity:
        writer.writerow([
            p.get("date", ""),
            p.get("portfolio_value", ""),
            p.get("benchmark_value", ""),
            p.get("drawdown", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="equity_curve_{result_id}.csv"'},
    )
