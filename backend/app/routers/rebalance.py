from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.rebalance_schemas import RebalanceExecutionPlan

from app.services.rebalance_service import rebalance_service

router = APIRouter(prefix="/rebalance", tags=["Rebalance & Attribution"])


@router.get("/strategy/{strategy_id}/plan", response_model=RebalanceExecutionPlan)
async def get_strategy_rebalance_plan(
    strategy_id: int,
    capital: float = Query(500000.0, description="Total portfolio investment capital in INR"),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an actionable rebalance execution order list with Risk-Parity/Target weights,
    turnover fees, and institutional factor & sector attribution analytics.
    """
    plan = await rebalance_service.generate_rebalance_plan(db, strategy_id, portfolio_capital=capital)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Strategy with ID {strategy_id} not found or lacks valid rules.")
    return plan


@router.post("/strategy/{strategy_id}/notify")
async def send_rebalance_notification(
    strategy_id: int,
    capital: float = Query(500000.0, description="Total portfolio capital for trade calculation"),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and immediately dispatch the rebalance trade order sheet via Resend Email & Telegram.
    """
    res = await rebalance_service.notify_user_rebalance(db, strategy_id, portfolio_capital=capital)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to dispatch notification"))
    return res
