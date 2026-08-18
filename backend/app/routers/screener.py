import json

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.strategy_schemas import StrategyRules, ScoredUniverse, MetricInfo
from app.services.rule_engine import rule_engine, METRIC_INFO

router = APIRouter(prefix="/screener", tags=["screener"])


@router.post("/run", response_model=ScoredUniverse)
async def run_screener(rules: StrategyRules, db: AsyncSession = Depends(get_db)):
    return await rule_engine.run(rules, db)


@router.get("/metrics", response_model=list[MetricInfo])
async def get_available_metrics():
    return METRIC_INFO
