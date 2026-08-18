import asyncio
from sqlalchemy import text
from app.core.database import get_db

async def run():
    db = [x async for x in get_db()][0]
    res = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_fundamentals';"))
    print("FUNDAMENTALS:")
    for row in res.fetchall():
        print(row[0])
        
    res2 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'technical_features';"))
    print("\nTECHNICAL:")
    for row in res2.fetchall():
        print(row[0])
        
asyncio.run(run())
