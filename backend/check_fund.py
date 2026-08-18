import asyncio, asyncpg
async def main():
    import os
    conn = await asyncpg.connect(os.environ.get("DATABASE_URL"))
    val = await conn.fetch('SELECT count(*) FROM fundamentals')
    print(val)
    await conn.close()
asyncio.run(main())
