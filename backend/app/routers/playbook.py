"""Playbook API Router for Strategy Intelligence Engine v2."""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Strategy
from app.models.strategy_schemas import StrategyRules
from app.models.playbook_schemas import StrategyPlaybook, PlaybookGenerateRequest
from app.services.playbook_service import playbook_service

router = APIRouter(prefix="/playbook", tags=["playbook"])


@router.post("/generate", response_model=StrategyPlaybook)
async def generate_playbook(
    request: PlaybookGenerateRequest, db: AsyncSession = Depends(get_db)
):
    """Generate a full Strategy Playbook with entry/exit guidance from strategy rules or ID."""
    rules = request.rules
    strategy_id = request.strategy_id

    if not rules and not strategy_id:
        raise HTTPException(
            status_code=400, detail="Must provide either 'rules' or 'strategy_id' to generate playbook."
        )

    if not rules and strategy_id:
        res = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
        st = res.scalar_one_or_none()
        if not st:
            raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found.")
        try:
            r_json = st.rules_json if isinstance(st.rules_json, dict) else json.loads(st.rules_json)
            rules = StrategyRules.model_validate(r_json)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Invalid stored strategy rules: {e}")

    try:
        playbook = await playbook_service.generate_playbook(db, rules, strategy_id=strategy_id)
        return playbook
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate playbook: {e}")


@router.get("/strategy/{strategy_id}", response_model=StrategyPlaybook)
async def get_strategy_playbook(strategy_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve or dynamically generate the Strategy Playbook for a saved strategy."""
    res = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    st = res.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found.")

    try:
        r_json = st.rules_json if isinstance(st.rules_json, dict) else json.loads(st.rules_json)
        rules = StrategyRules.model_validate(r_json)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid stored strategy rules: {e}")

    try:
        playbook = await playbook_service.generate_playbook(db, rules, strategy_id=strategy_id)
        return playbook
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate playbook: {e}")
