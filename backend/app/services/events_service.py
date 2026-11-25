"""Company events from Yahoo (weekly): expected results dates, dividends and splits since 2021."""
import asyncio
from datetime import date, datetime

import yfinance as yf
from loguru import logger
from sqlalchemy import text

SINCE = date(2021, 1, 1)


def _day(x) -> date | None:
    if isinstance(x, datetime):
        return x.date()
    if isinstance(x, date):
        return x
    try:
        return x.date()  # pandas Timestamp
    except AttributeError:
        return None


def events_from(calendar: dict | None, dividends, splits) -> list[dict]:
    """Rows of (kind, event_date, amount) from yfinance's calendar dict and dividends/splits series."""
    out = []
    dates = (calendar or {}).get("Earnings Date") or []
    if dates:
        d = _day(dates[0])
        if d:
            out.append({"kind": "results", "event_date": d, "amount": None})
    for series, kind in ((dividends, "dividend"), (splits, "split")):
        for ts, amount in (series.items() if series is not None else []):
            d = _day(ts)
            if d and d >= SINCE and amount and amount > 0:
                out.append({"kind": kind, "event_date": d, "amount": float(amount)})
    return out


def _fetch(symbol: str) -> list[dict]:
    t = yf.Ticker(symbol)
    try:
        cal = t.calendar
    except Exception:
        cal = None
    return events_from(cal if isinstance(cal, dict) else None, t.dividends, t.splits)


async def sync_events(db, pause: float = 0.3) -> int:
    stocks = (await db.execute(text("select id, ticker from stocks where is_index_member"))).all()
    total = 0
    for i, (sid, ticker) in enumerate(stocks):
        try:
            rows = await asyncio.to_thread(_fetch, ticker)
        except Exception as e:
            logger.warning(f"events {ticker}: {e}")
            continue
        if rows:
            # a stale "expected results" date is replaced, not kept beside the new one
            await db.execute(text("delete from stock_events where stock_id = :s and kind = 'results' and event_date >= current_date"), {"s": sid})
            await db.execute(text("""
                insert into stock_events (stock_id, kind, event_date, amount, updated_at)
                values (:s, :kind, :event_date, :amount, now())
                on conflict (stock_id, kind, event_date) do update set amount = excluded.amount, updated_at = now()"""),
                [{"s": sid, **r} for r in rows])
            await db.commit()
            total += len(rows)
        if i % 100 == 0:
            logger.info(f"events: {i}/{len(stocks)}")
        await asyncio.sleep(pause)
    return total
