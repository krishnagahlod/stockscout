"""Alerts API router — CRUD and thesis break checking."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Alert
from app.services.alert_service import evaluate_all_strategies

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    strategy_id: Optional[int] = Query(None),
    is_read: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List alerts, optionally filtered."""
    query = select(Alert).order_by(desc(Alert.triggered_at)).limit(limit)
    if strategy_id is not None:
        query = query.where(Alert.strategy_id == strategy_id)
    if is_read is not None:
        query = query.where(Alert.is_read == is_read)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [
        {
            "id": a.id,
            "strategy_id": a.strategy_id,
            "stock_id": a.stock_id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "is_read": a.is_read,
            "triggered_at": str(a.triggered_at) if a.triggered_at else None,
        }
        for a in alerts
    ]


@router.get("/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db)):
    """Get count of unread alerts."""
    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.is_read == False)
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.put("/{alert_id}/read")
async def mark_read(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Mark an alert as read."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_read = True
    await db.commit()
    return {"message": "Alert marked as read"}


@router.put("/mark-all-read")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    """Mark all alerts as read."""
    await db.execute(update(Alert).where(Alert.is_read == False).values(is_read=True))
    await db.commit()
    return {"message": "All alerts marked as read"}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(alert)
    await db.commit()
    return {"message": "Alert deleted"}


@router.post("/check-thesis-breaks")
async def run_thesis_check(db: AsyncSession = Depends(get_db)):
    """Manually trigger thesis break checking for all strategies."""
    await evaluate_all_strategies(db)
    return {"message": "Checked strategies, generated alerts if needed"}
