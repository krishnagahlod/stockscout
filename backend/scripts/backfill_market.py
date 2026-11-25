"""One-off: fill market_daily (index close, P/E, P/B, dividend yield) from NSE's daily index files since 2016.
Run: python scripts/backfill_market.py [YYYY-MM-DD]"""
import asyncio
import os
import sys
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import httpx
from sqlalchemy import text

from app.core.database import async_session
from app.services.nse_service import HEADERS, INDEX_URL, parse_index_close

UPSERT = text("""
    insert into market_daily (index_name, date, close, pe, pb, div_yield) values (:n, :d, :close, :pe, :pb, :div_yield)
    on conflict (index_name, date) do update set close = excluded.close, pe = excluded.pe, pb = excluded.pb, div_yield = excluded.div_yield""")


async def main(start: date):
    have = set()
    async with async_session() as db:
        have = {r[0] for r in (await db.execute(text("select distinct date from market_daily where index_name = 'nifty 50'"))).all()}
        d, done = start, 0
        async with httpx.AsyncClient(timeout=30, headers=HEADERS, follow_redirects=True) as client:
            while d <= date.today():
                if d.weekday() < 5 and d not in have:
                    try:
                        r = await client.get(INDEX_URL.format(d=d))
                        day, rows = parse_index_close(r.text) if r.status_code == 200 else (None, {})
                        if day and day not in have and rows:
                            await db.execute(UPSERT, [{"n": n, "d": day, **v} for n, v in rows.items()])
                            await db.commit()
                            have.add(day)
                            done += 1
                    except Exception as e:
                        print(f"{d}: {e}")
                    await asyncio.sleep(0.3)
                    if done and done % 100 == 0:
                        print(f"{d}: {done} days", flush=True)
                d += timedelta(days=1)
    print(f"done: {done} days")


asyncio.run(main(date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date(2016, 1, 1)))
