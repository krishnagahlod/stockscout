from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Stock, DailyPrice
from app.models.schemas import StockOut, StockDetail, PriceOut, PaginatedResponse

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("", response_model=PaginatedResponse)
async def list_stocks(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    sector: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Stock).where(Stock.is_nifty500 == True)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Stock.symbol.ilike(search_term)) | (Stock.name.ilike(search_term))
        )

    if sector:
        query = query.where(Stock.sector == sector)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(Stock.symbol).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    stocks = result.scalars().all()

    return PaginatedResponse(
        items=[StockOut.model_validate(s) for s in stocks],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/sectors")
async def list_sectors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Stock.sector).where(Stock.sector.isnot(None)).distinct().order_by(Stock.sector)
    )
    return [row[0] for row in result.all()]


@router.get("/search-all")
async def search_all_stocks(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search across ALL stocks in the database (not just Nifty 500).
    Returns results with a flag indicating whether we have historical data."""
    search_term = f"%{q}%"
    query = (
        select(Stock)
        .where((Stock.symbol.ilike(search_term)) | (Stock.name.ilike(search_term)))
        .limit(limit)
    )
    result = await db.execute(query)
    stocks = result.scalars().all()
    
    output = []
    for s in stocks:
        output.append({
            "symbol": s.symbol,
            "name": s.name,
            "sector": s.sector,
            "market_cap_cr": s.market_cap_cr,
            "is_nifty500": s.is_nifty500,
            "has_price_data": s.is_nifty500,  # We only synced data for Nifty 500
        })
    return output


@router.get("/{symbol}", response_model=StockDetail)
async def get_stock(symbol: str, db: AsyncSession = Depends(get_db)):
    # Try exact match first, then with .NS suffix
    result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = result.scalar_one_or_none()

    if not stock and not symbol.endswith(".NS"):
        result = await db.execute(select(Stock).where(Stock.symbol == f"{symbol}.NS"))
        stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    return StockDetail.model_validate(stock)


@router.get("/{symbol}/prices", response_model=list[PriceOut])
async def get_stock_prices(
    symbol: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    limit: int = Query(500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    # Find the stock
    result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = result.scalar_one_or_none()

    if not stock and not symbol.endswith(".NS"):
        result = await db.execute(select(Stock).where(Stock.symbol == f"{symbol}.NS"))
        stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    query = select(DailyPrice).where(DailyPrice.stock_id == stock.id)

    if start:
        query = query.where(DailyPrice.date >= start)
    if end:
        query = query.where(DailyPrice.date <= end)

    query = query.order_by(DailyPrice.date.desc()).limit(limit)
    result = await db.execute(query)
    prices = result.scalars().all()

    return [PriceOut.model_validate(p) for p in prices]

@router.get("/search-all")
async def search_all_stocks(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search across ALL stocks in the database (not just Nifty 500).
    Returns results with a flag indicating whether we have historical data."""
    search_term = f"%{q}%"
    query = (
        select(Stock)
        .where((Stock.symbol.ilike(search_term)) | (Stock.name.ilike(search_term)))
        .limit(limit)
    )
    result = await db.execute(query)
    stocks = result.scalars().all()
    
    output = []
    for s in stocks:
        output.append({
            "symbol": s.symbol,
            "name": s.name,
            "sector": s.sector,
            "market_cap_cr": s.market_cap_cr,
            "is_nifty500": s.is_nifty500,
            "has_price_data": s.is_nifty500,  # We only synced data for Nifty 500
        })
    return output
