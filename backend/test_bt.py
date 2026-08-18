import asyncio
from app.services.backtest_service import PortfolioBacktester
from app.models.strategy_schemas import StrategyRules
from app.core.database import async_session
from datetime import date
from loguru import logger
import sys

logger.remove()
logger.add(sys.stdout, level="DEBUG")

async def test():
    rules = StrategyRules.model_validate({'name':'test', 'universe':'nifty500', 'filters':[{'metric':'market_cap', 'op':'>', 'value':100}]})
    bt = PortfolioBacktester(rules, date(2023, 1, 1), date(2023, 12, 31))
    async with async_session() as db:
        await bt.load_data(db)
        res = bt.run()
        print('Total Trades:', len(res['trades']))

asyncio.run(test())
