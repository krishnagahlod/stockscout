from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Strategy, BacktestResult
from app.models.strategy_schemas import StrategyCreate, StrategyUpdate, StrategyOut
from app.models.schemas import PaginatedResponse

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.get("", response_model=PaginatedResponse)
async def list_strategies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Strategy)
    if status:
        query = query.where(Strategy.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Strategy.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    strategies = result.scalars().all()

    return PaginatedResponse(
        items=[StrategyOut.model_validate(s) for s in strategies],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{strategy_id}", response_model=StrategyOut)
async def get_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return StrategyOut.model_validate(strategy)


@router.post("", response_model=StrategyOut)
async def create_strategy(data: StrategyCreate, db: AsyncSession = Depends(get_db)):
    strategy = Strategy(
        name=data.name,
        description=data.description,
        user_prompt=data.user_prompt,
        rules_json=data.rules_json,
        strategy_type=data.strategy_type,
        position_sizing=data.position_sizing,
        universe=data.universe,
        status="draft",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return StrategyOut.model_validate(strategy)


@router.put("/{strategy_id}", response_model=StrategyOut)
async def update_strategy(strategy_id: int, data: StrategyUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    if data.name is not None:
        strategy.name = data.name
    if data.description is not None:
        strategy.description = data.description
    if data.rules_json is not None:
        strategy.rules_json = data.rules_json
    if data.strategy_type is not None:
        strategy.strategy_type = data.strategy_type
    if data.position_sizing is not None:
        strategy.position_sizing = data.position_sizing
    if data.universe is not None:
        strategy.universe = data.universe
    if data.status is not None:
        strategy.status = data.status
    strategy.updated_at = datetime.utcnow()

    # If rules change, we should invalidate the old backtest results so they don't bleed into the UI
    if data.rules_json is not None:
        await db.execute(delete(BacktestResult).where(BacktestResult.strategy_id == strategy_id))

    await db.commit()
    await db.refresh(strategy)
    return StrategyOut.model_validate(strategy)


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    strategy.status = "archived"
    strategy.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Strategy archived"}
