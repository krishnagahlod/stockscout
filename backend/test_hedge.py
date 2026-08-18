import asyncio
from app.core.database import async_session
from sqlalchemy import select
from app.models.db_models import Strategy
from app.services.backtest_service import run_backtest
from app.models.backtest_schemas import BacktestRequest

async def main():
    async with async_session() as db:
        result = await db.execute(select(Strategy).where(Strategy.id == 12))
        strategy = result.scalar_one_or_none()
        
        if strategy is None:
            print("Strategy 12 not found. Exiting.")
            return

        # Override rules for test
        import json
        rules = strategy.rules_json if isinstance(strategy.rules_json, dict) else json.loads(strategy.rules_json)
        rules["strategy_type"] = "long_short"
        rules["hedge_ratio"] = 0.5
        strategy.rules_json = json.dumps(rules)
        await db.commit()
        
        req = BacktestRequest(
            strategy_id=12,
            start_date="2020-01-01",
            end_date="2025-01-22",
            initial_capital=100000,
            tx_cost_bps=10,
            slippage_bps=5,
            rebalance_frequency="monthly"
        )
        print("Running backtest...")
        try:
            res = await run_backtest(req, db)
            print("SUCCESS! CAGR:", res.metrics.cagr)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
