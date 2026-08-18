from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.schemas import HealthResponse
from app.services.data_service import get_stock_count, get_price_count, get_last_sync_time

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        stock_count = await get_stock_count(db)
        price_count = await get_price_count(db)
        last_sync = await get_last_sync_time(db, "sync_prices")
        return HealthResponse(
            status="healthy",
            db_connected=True,
            stock_count=stock_count,
            price_count=price_count,
            last_sync=last_sync,
        )
    except Exception as e:
        return HealthResponse(
            status=f"error: {str(e)}",
            db_connected=False,
            stock_count=0,
            price_count=0,
        )
