import asyncio
from sqlalchemy import select
from app.core.database import async_session
from app.models.db_models import Strategy
from app.models.strategy_schemas import StrategyRules
from app.models.backtest_schemas import BacktestRequest
from app.services.backtest_service import run_backtest

async def main():
    async with async_session() as db:
        res = await db.execute(select(Strategy))
        strategies = res.scalars().all()
        print(f"Found {len(strategies)} total strategies in DB:\n")
        
        for s in strategies:
            print(f"--- Strategy ID={s.id}: '{s.name}' (status={s.status}) ---")
            try:
                if isinstance(s.rules_json, (dict, list)):
                    rules = StrategyRules.model_validate(s.rules_json)
                else:
                    rules = StrategyRules.model_validate_json(s.rules_json)
                print(f"  Rules validation: OK! ({len(rules.filters)} filters)")
            except Exception as e:
                print(f"  Rules validation FAILED: {e}")
                continue
                
            try:
                req = BacktestRequest(
                    strategy_id=s.id,
                    start_date="01-01-2020",
                    end_date="22-01-2025",
                    initial_capital=1000000.0,
                    rebalance_frequency="quarterly"
                )
                out = await run_backtest(req, db)
                print(f"  Backtest run: SUCCESS! (CAGR={out.metrics.cagr}, Sharpe={out.metrics.sharpe_ratio}, Trades={len(out.trades)})")
            except Exception as e:
                print(f"  Backtest run FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
