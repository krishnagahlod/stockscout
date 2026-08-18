from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.db_models import Alert

router = APIRouter()

class AlertResponse(BaseModel):
    id: int
    strategy_id: Optional[int]
    stock_id: Optional[int]
    alert_type: str
    severity: str
    title: str
    message: str
    is_read: bool
    triggered_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    strategy_id: Optional[int] = None,
    is_read: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Alert).order_by(Alert.triggered_at.desc())
    if strategy_id is not None:
        query = query.where(Alert.strategy_id == strategy_id)
    if is_read is not None:
        query = query.where(Alert.is_read == is_read)
        
    result = await db.execute(query)
    alerts = result.scalars().all()
    return alerts

@router.put("/{alert_id}/read", response_model=AlertResponse)
async def mark_alert_read(
    alert_id: int,
    db: AsyncSession = Depends(get_db)
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.is_read = True
    await db.commit()
    await db.refresh(alert)
    return alert
