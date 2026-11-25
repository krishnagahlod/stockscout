"""
One-off: load today's funds from AMFI, then NAV history since 2019 from mfapi.in (a free mirror of AMFI's
data), kept weekly (last NAV of each week) except the last 30 days. Safe to re-run.
Run from backend/: python scripts/backfill_funds.py
"""
import asyncio
import os
import sys
from datetime import date, datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import httpx
from loguru import logger
from sqlalchemy import text

from app.core.database import async_session
from app.services.fund_service import refresh_fund_metrics, sync_funds

SINCE = date(2019, 1, 1)


def thin(points: list[tuple]) -> list[tuple]:
    """Keep every point from the last 30 days, and the last point of each week before that."""
    recent_cut = date.today() - timedelta(days=30)
    weekly: dict[tuple, tuple] = {}
    out = []
    for d, v in sorted(points):
        if d >= recent_cut:
            out.append((d, v))
        else:
            weekly[d.isocalendar()[:2]] = (d, v)
    return sorted(weekly.values()) + out


async def main():
    async with async_session() as db:
        logger.info(f"AMFI: {await sync_funds(db)}")
        codes = [c for (c,) in (await db.execute(text("select scheme_code from funds"))).all()]

    sem = asyncio.Semaphore(6)
    done = 0

    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "StockScout/1.0"}) as client:
        async def history(code):
            nonlocal done
            async with sem:
                for attempt in range(3):
                    try:
                        r = await client.get(f"https://api.mfapi.in/mf/{code}")
                        r.raise_for_status()
                        rows = r.json().get("data", [])
                        break
                    except Exception as e:
                        if attempt == 2:
                            logger.warning(f"{code}: {e}")
                            return code, []
                        await asyncio.sleep(2)
            pts = []
            for row in rows:
                try:
                    d = datetime.strptime(row["date"], "%d-%m-%Y").date()
                    v = float(row["nav"])
                except (KeyError, ValueError):
                    continue
                if d >= SINCE and v > 0:
                    pts.append((d, v))
            done += 1
            if done % 100 == 0:
                logger.info(f"{done}/{len(codes)} fetched")
            return code, thin(pts)

        results = await asyncio.gather(*(history(c) for c in codes))

    async with async_session() as db:
        total = 0
        for code, pts in results:
            if not pts:
                continue
            await db.execute(text("insert into fund_nav (scheme_code, date, nav) values (:c, :d, :v) on conflict do nothing"),
                             [{"c": code, "d": d, "v": v} for d, v in pts])
            total += len(pts)
        await db.commit()
        logger.info(f"inserted up to {total} NAV rows")
        await refresh_fund_metrics(db)


if __name__ == "__main__":
    asyncio.run(main())
