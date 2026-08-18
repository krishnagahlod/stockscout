import asyncio
from app.core.database import engine
from sqlalchemy import text

async def fix_sequences():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("SELECT setval('strategies_id_seq', COALESCE((SELECT MAX(id) FROM strategies), 1));"))
            print('Fixed strategies_id_seq')
        except Exception as e:
            print(e)
            
        try:
            await conn.execute(text("SELECT setval('backtest_results_id_seq', COALESCE((SELECT MAX(id) FROM backtest_results), 1));"))
            print('Fixed backtest_results_id_seq')
        except Exception as e:
            print(e)

if __name__ == '__main__':
    asyncio.run(fix_sequences())
