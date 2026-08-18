import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='holdings'"))
        columns = [row[0] for row in res]
        print("Holdings columns:", columns)
        
        res2 = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [row[0] for row in res2]
        print("Tables:", tables)

asyncio.run(main())
