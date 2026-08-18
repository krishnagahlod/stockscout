"""Scheduler API router — status and manual job triggers."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import SchedulerLog
from app.services.scheduler_service import get_scheduler_status

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


@router.get("/status")
async def scheduler_status():
    """Get scheduler status and upcoming jobs."""
    return get_scheduler_status()


@router.get("/logs")
async def scheduler_logs(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get recent scheduler job logs."""
    result = await db.execute(
        select(SchedulerLog)
        .order_by(desc(SchedulerLog.id))
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "job_name": log.job_name,
            "status": log.status,
            "message": log.message,
            "started_at": str(log.started_at) if log.started_at else None,
            "completed_at": str(log.completed_at) if log.completed_at else None,
        }
        for log in logs
    ]


@router.post("/trigger/{job_name}")
async def trigger_job(job_name: str):
    """Manually trigger a scheduled job."""
    from app.services.scheduler_service import (
        job_sync_prices,
        job_recompute_features,
        job_sync_fundamentals,
        job_regime_check,
    )

    job_map = {
        "daily_price_sync": job_sync_prices,
        "weekly_feature_recompute": job_recompute_features,
        "weekly_fundamental_sync": job_sync_fundamentals,
        "daily_regime_check": job_regime_check,
    }

    job_fn = job_map.get(job_name)
    if not job_fn:
        return {"error": f"Unknown job: {job_name}", "available": list(job_map.keys())}

    # Run in background
    import asyncio
    asyncio.create_task(job_fn())

    return {"message": f"Job '{job_name}' triggered"}
