import asyncio
from sqlalchemy import select
from app.core.database import async_session
from app.models.db_models import Strategy
from app.models.backtest_schemas import BacktestRequest
from app.services.backtest_service import run_backtest

async def main():
    async with async_session() as db:
        res = await db.execute(select(Strategy).order_by(Strategy.id.desc()).limit(1))
        strat = res.scalar_one_or_none()
        if not strat:
            print("No strategy found in DB")
            return
        
        print(f"Testing backtest with dates '01-01-2020' and '22-01-2025' for strategy ID={strat.id}, Name='{strat.name}'")
        req = BacktestRequest(
            strategy_id=strat.id,
            start_date="01-01-2020",
            end_date="22-01-2025",
            initial_capital=1000000.0,
            rebalance_frequency="quarterly"
        )
        out = await run_backtest(req, db)
        print(f"SUCCESS: Backtest completed with date parsing!")
        print(f"CAGR: {out.metrics.cagr}, Sharpe: {out.metrics.sharpe_ratio}, Trades: {len(out.trades)}")

if __name__ == "__main__":
    asyncio.run(main())
