from typing import Optional

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Stock
from app.models.schemas import SyncStatus, SyncResult
from app.services.data_service import (
    sync_universe_from_csv,
    sync_prices_for_stock,
    start_price_sync_background,
    sync_progress,
    get_stock_count,
    get_price_count,
    get_last_sync_time,
)

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/status", response_model=SyncStatus)
async def get_sync_status(db: AsyncSession = Depends(get_db)):
    return SyncStatus(
        total_stocks=await get_stock_count(db),
        total_prices=await get_price_count(db),
        last_universe_sync=await get_last_sync_time(db, "sync_universe"),
        last_price_sync=await get_last_sync_time(db, "sync_prices"),
    )


@router.post("/sync-universe", response_model=SyncResult)
async def sync_universe(db: AsyncSession = Depends(get_db)):
    try:
        count = await sync_universe_from_csv(db)
        return SyncResult(
            success=True,
            message=f"Successfully synced {count} tickers to universe",
            records_affected=count,
        )
    except Exception as e:
        return SyncResult(success=False, message=f"Sync failed: {str(e)}")


@router.post("/sync-all", response_model=SyncResult)
async def sync_all(background_tasks: BackgroundTasks):
    from scripts.sync_all import sync_everything
    import asyncio
    background_tasks.add_task(lambda: asyncio.create_task(sync_everything()))
    return SyncResult(
        success=True,
        message="Full system sync has been started in the background. Check progress logs.",
        records_affected=0,
    )


@router.post("/sync-prices", response_model=SyncResult)
async def sync_prices(
    limit: Optional[int] = Query(None, description="Max number of stocks to sync"),
    symbol: Optional[str] = Query(None, description="Sync a specific symbol only"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    # Single stock sync: still done inline (fast enough)
    if symbol:
        try:
            result = await db.execute(select(Stock).where(Stock.symbol == symbol))
            stock = result.scalar_one_or_none()
            if not stock and not symbol.endswith(".NS"):
                result = await db.execute(
                    select(Stock).where(Stock.symbol == f"{symbol}.NS")
                )
                stock = result.scalar_one_or_none()

            if not stock:
                return SyncResult(success=False, message=f"Stock {symbol} not found")

            count = await sync_prices_for_stock(db, stock, start_date=start_date)
            return SyncResult(
                success=True,
                message=f"Synced {count} price records for {stock.symbol}",
                records_affected=count,
            )
        except Exception as e:
            return SyncResult(success=False, message=f"Price sync failed: {str(e)}")

    # Multi-stock sync: run in background, return immediately
    if sync_progress.is_running:
        return SyncResult(
            success=False,
            message=f"Sync already in progress ({sync_progress.completed}/{sync_progress.total} stocks done)",
        )

    started = start_price_sync_background(limit=limit, start_date=start_date)
    if started:
        return SyncResult(
            success=True,
            message="Price sync started in background. Check progress below.",
            records_affected=0,
        )
    else:
        return SyncResult(success=False, message="Failed to start sync")


@router.get("/sync-progress")
async def get_sync_progress():
    """Poll this endpoint to track background price sync progress."""
    return sync_progress.to_dict()
