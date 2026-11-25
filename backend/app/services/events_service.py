"""Company events: results dates from NSE board-meeting notices (nightly); dividends, splits and estimated
results dates from Yahoo (weekly, since 2021). An announced NSE date always wins over Yahoo's estimate."""
import asyncio
import re
from datetime import date, datetime, timedelta

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
    announced = {r[0] for r in (await db.execute(text(
        "select stock_id from stock_events where kind = 'results' and source = 'nse' and event_date >= current_date"))).all()}
    total = 0
    for i, (sid, ticker) in enumerate(stocks):
        try:
            rows = await asyncio.to_thread(_fetch, ticker)
        except Exception as e:
            logger.warning(f"events {ticker}: {e}")
            continue
        if sid in announced:
            rows = [r for r in rows if r["kind"] != "results"]
        if rows:
            # a stale estimated results date is replaced, not kept beside the new one
            await db.execute(text("delete from stock_events where stock_id = :s and kind = 'results' and event_date >= current_date and source = 'yahoo'"), {"s": sid})
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


RESULTS = re.compile(r"financial result", re.I)


def pick_results_dates(meetings: list, today: date) -> dict[str, date]:
    """NSE board-meeting notices -> {symbol: date of the next results meeting}. A later notice (e.g. a reschedule) wins."""
    best: dict[str, tuple[datetime, date]] = {}
    for m in meetings or []:
        if not RESULTS.search(f"{m.get('bm_purpose', '')} {m.get('bm_desc', '')}"):
            continue
        try:
            d = datetime.strptime(m["bm_date"], "%d-%b-%Y").date()
            ts = datetime.strptime(m.get("bm_timestamp") or "01-Jan-2000 00:00:00", "%d-%b-%Y %H:%M:%S")
        except (KeyError, ValueError):
            continue
        sym = m.get("bm_symbol")
        if sym and d >= today and (sym not in best or ts > best[sym][0]):
            best[sym] = (ts, d)
    return {sym: d for sym, (_, d) in best.items()}


async def sync_results_dates(db, days: int = 60) -> int:
    """Results meetings announced on NSE for the next `days` days replace any other future results date."""
    from app.services.filings_service import Nse
    today = date.today()
    nse = Nse()
    try:
        meetings = await nse.get(f"corporate-board-meetings?index=equities&from_date={today:%d-%m-%Y}&to_date={today + timedelta(days=days):%d-%m-%Y}")
    finally:
        await nse.close()
    picks = pick_results_dates(meetings, today)
    ids = {t.removesuffix(".NS"): sid for sid, t in (await db.execute(text(
        "select id, ticker from stocks where is_index_member and ticker like '%.NS'"))).all()}
    rows = [{"s": ids[sym], "d": d} for sym, d in picks.items() if sym in ids]
    for r in rows:
        await db.execute(text("delete from stock_events where stock_id = :s and kind = 'results' and event_date >= current_date and event_date <> :d"), r)
    if rows:
        await db.execute(text("""
            insert into stock_events (stock_id, kind, event_date, amount, source, updated_at) values (:s, 'results', :d, null, 'nse', now())
            on conflict (stock_id, kind, event_date) do update set source = 'nse', updated_at = now()"""), rows)
    await db.commit()
    return len(rows)
