import asyncio, asyncpg
async def main():
    import os
    conn = await asyncpg.connect(os.environ.get("DATABASE_URL"))
    val = await conn.fetch('SELECT min(as_of_date), max(as_of_date) FROM stock_fundamentals')
    print(val)
    await conn.close()
asyncio.run(main())
