import asyncio, json
from app.core.database import async_session
from app.models.db_models import Strategy
from sqlalchemy import select

async def get_latest_strategy():
    async with async_session() as db:
        res = await db.execute(select(Strategy).order_by(Strategy.id.desc()).limit(1))
        strategy = res.scalar_one_or_none()
        if strategy:
            print(json.dumps(strategy.rules_json, indent=2))
        else:
            print("No strategy found")

asyncio.run(get_latest_strategy())
