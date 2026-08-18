from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.database import get_db
from app.models.monitor_schemas import StrategyDriftReport
from app.services.strategy_monitor_service import strategy_monitor

router = APIRouter(prefix="/monitor", tags=["strategy-monitor"])


@router.get("/strategy/{strategy_id}/drift", response_model=StrategyDriftReport)
async def get_strategy_drift(
    strategy_id: int,
    send_notifications: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates real-time health score, stop-loss / take-profit boundary status,
    rule factor erosion, and regime drift for a specific strategy.
    """
    report = await strategy_monitor.check_strategy_drift(
        db, strategy_id=strategy_id, send_notifications=send_notifications
    )
    if not report:
        raise HTTPException(
            status_code=404, detail="Strategy not found or rules not configured."
        )
    return report


@router.post("/run-all", response_model=List[StrategyDriftReport])
async def run_batch_monitoring(db: AsyncSession = Depends(get_db)):
    """
    Runs scheduled drift evaluation across all active strategies in the database.
    Dispatches automated Resend email and Telegram notifications for any strategies needing rebalance or critical intervention.
    """
    reports = await strategy_monitor.monitor_all_active_strategies(db)
    return reports
