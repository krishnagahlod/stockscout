import asyncio, sys
from app.services.backtest_service import PortfolioBacktester
from app.models.strategy_schemas import StrategyRules
from app.core.database import async_session
from app.models.db_models import Strategy
from datetime import date
from loguru import logger
from sqlalchemy import select

logger.remove()
logger.add(sys.stdout, level="INFO")

async def test():
    async with async_session() as db:
        res = await db.execute(select(Strategy).order_by(Strategy.id.desc()).limit(1))
        strategy = res.scalar_one_or_none()
        rules = StrategyRules.model_validate(strategy.rules_json)
        bt = PortfolioBacktester(rules, date(2020, 1, 1), date(2024, 12, 31))
        await bt.load_data(db)
        res = bt.run()
        print('Total Trades:', len(res['trades']))

asyncio.run(test())
