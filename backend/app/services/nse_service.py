"""
Delivery % from NSE's official end-of-day file (sec_bhavdata_full_DDMMYYYY.csv on nsearchives): the share of
traded quantity that buyers actually took into their demat accounts rather than selling the same day.
"""
import csv
import io
from datetime import date, timedelta

import httpx
from loguru import logger
from sqlalchemy import text

URL = "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d:%d%m%Y}.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockScout/1.0)", "Accept": "text/csv,*/*"}


def parse_delivery(body: str) -> dict[str, float]:
    """{SYMBOL: delivery %} for the EQ series rows of a full bhavcopy."""
    out = {}
    reader = csv.DictReader(io.StringIO(body))
    for row in reader:
        row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        if row.get("SERIES") != "EQ":
            continue
        try:
            out[row["SYMBOL"]] = float(row["DELIV_PER"])
        except (KeyError, ValueError):
            continue
    return out


async def sync_delivery(db, days: int = 10) -> int:
    """Fill delivery_pct for recent trading days that don't have it yet. A missing file (holiday) is skipped."""
    rows = (await db.execute(text("""
        select distinct p.date from daily_prices p join stocks s on s.id = p.stock_id
        where s.is_index_member and p.date >= :since and p.delivery_pct is null"""), {"since": date.today() - timedelta(days=days)})).all()
    updated = 0
    async with httpx.AsyncClient(timeout=30, headers=HEADERS, follow_redirects=True) as client:
        for (d,) in sorted(rows):
            try:
                r = await client.get(URL.format(d=d))
                if r.status_code != 200:
                    logger.info(f"delivery: no NSE file for {d} ({r.status_code})")
                    continue
                by_symbol = parse_delivery(r.text)
            except Exception as e:
                logger.warning(f"delivery {d}: {e}")
                continue
            params = [{"t": f"{sym}.NS", "d": d, "v": v} for sym, v in by_symbol.items()]
            if params:
                await db.execute(text("""
                    update daily_prices p set delivery_pct = :v from stocks s
                    where s.id = p.stock_id and s.ticker = :t and p.date = :d"""), params)
                await db.commit()
                updated += 1  # days filled (bulk updates do not report a row count)
    return updated
