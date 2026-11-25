"""
NSE's official end-of-day files on nsearchives, our primary source for prices since 25 Nov 2026 (Yahoo is the fallback):
- sec_bhavdata_full_DDMMYYYY.csv: open, high, low, close, volume and delivery % for every listed share and ETF.
- ind_close_all_DDMMYYYY.csv: closing value, P/E, P/B and dividend yield for every NSE index.
On a holiday NSE re-publishes the previous day's file, so the trading date always comes from inside the file.
"""
import csv
import io
from datetime import date, datetime, timedelta

import httpx
from loguru import logger
from sqlalchemy import text

BHAV_URL = "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d:%d%m%Y}.csv"
INDEX_URL = "https://nsearchives.nseindia.com/content/indices/ind_close_all_{d:%d%m%Y}.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockScout/1.0)", "Accept": "text/csv,*/*"}

# Indices kept in market_daily (lower-case, as names changed case over the years). Nifty 50 also feeds ^NSEI prices.
INDICES = {
    "nifty 50", "nifty next 50", "nifty 500", "nifty midcap 150", "nifty smallcap 250", "india vix",
    "nifty bank", "nifty it", "nifty pharma", "nifty fmcg", "nifty auto", "nifty metal", "nifty realty",
    "nifty energy", "nifty financial services", "nifty healthcare index",
}


def _num(v: str):
    try:
        x = float(v)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


def parse_bhav(body: str) -> tuple[date | None, dict[str, dict]]:
    """(trading date, {SYMBOL: {open, high, low, close, volume, delivery_pct}}) for EQ and BE rows."""
    day, out = None, {}
    for row in csv.DictReader(io.StringIO(body)):
        row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        if row.get("SERIES") not in ("EQ", "BE"):
            continue
        close = _num(row.get("CLOSE_PRICE"))
        if not close or close <= 0:
            continue
        try:
            day = day or datetime.strptime(row["DATE1"], "%d-%b-%Y").date()
        except (KeyError, ValueError):
            continue
        vol = _num(row.get("TTL_TRD_QNTY"))
        # BE (trade-for-trade) rows have no delivery figure; an EQ row wins if a symbol somehow has both
        if row["SERIES"] == "BE" and row["SYMBOL"] in out:
            continue
        out[row["SYMBOL"]] = {
            "open": _num(row.get("OPEN_PRICE")) or close, "high": _num(row.get("HIGH_PRICE")) or close,
            "low": _num(row.get("LOW_PRICE")) or close, "close": close,
            "volume": int(vol) if vol is not None else None, "delivery_pct": _num(row.get("DELIV_PER")),
        }
    return day, out


def parse_index_close(body: str) -> tuple[date | None, dict[str, dict]]:
    """(trading date, {index name: {open, high, low, close, pe, pb, div_yield}}) for the indices we keep."""
    day, out = None, {}
    for row in csv.DictReader(io.StringIO(body)):
        row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        name = row.get("Index Name", "")
        close = _num(row.get("Closing Index Value"))
        if name.lower() not in INDICES or not close:
            continue
        try:
            day = day or datetime.strptime(row["Index Date"], "%d-%m-%Y").date()
        except (KeyError, ValueError):
            continue
        out[name.lower()] = {
            "open": _num(row.get("Open Index Value")) or close, "high": _num(row.get("High Index Value")) or close,
            "low": _num(row.get("Low Index Value")) or close, "close": close,
            "pe": _num(row.get("P/E")), "pb": _num(row.get("P/B")), "div_yield": _num(row.get("Div Yield")),
        }
    return day, out


def plan_appends(latest: dict[int, date], day: date, by_symbol: dict[str, dict], ids: dict[str, int], no_delivery=frozenset()):
    """
    Split one NSE day into (new rows, delivery % for stored rows in `no_delivery`, a set of (stock_id, date)). Rows are only appended after a stock's latest stored date:
    older dates may already be split-adjusted by price_cleaning, and a raw NSE price there would undo that.
    """
    new, fills = [], []
    for sym, v in by_symbol.items():
        sid = ids.get(sym)
        if sid is None:
            continue
        if latest.get(sid) is None or day > latest[sid]:
            new.append({"stock_id": sid, "date": day, **v})
            latest[sid] = day
        elif v["delivery_pct"] is not None and (sid, day) in no_delivery:
            fills.append({"sid": sid, "d": day, "v": v["delivery_pct"]})
    return new, fills


INSERT_PRICE = text("""
    insert into daily_prices (stock_id, date, open, high, low, close, adj_close, volume, delivery_pct, dividends, stock_splits, source)
    values (:stock_id, :date, :open, :high, :low, :close, :close, coalesce(:volume, 0), :delivery_pct, 0, 0, 'nse')
    on conflict (stock_id, date) do nothing""")


async def _get(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        r = await client.get(url)
        return r.text if r.status_code == 200 else None
    except Exception as e:
        logger.warning(f"nse: {url}: {e}")
        return None


async def sync_nse(db, days: int = 10) -> dict:
    """Append the last `days` of NSE prices (shares, ETFs, Nifty 50), fill delivery %, and store index valuations."""
    stocks = (await db.execute(text("""
        select s.id, s.ticker, max(p.date) from stocks s left join daily_prices p on p.stock_id = s.id
        where s.is_index_member or s.sector in ('ETF', 'Index') group by s.id, s.ticker"""))).all()
    ids = {t.removesuffix(".NS"): sid for sid, t, _ in stocks if t.endswith(".NS")}
    latest = {sid: d for sid, _, d in stocks}
    since = date.today() - timedelta(days=days + 1)
    no_delivery = set(map(tuple, (await db.execute(text(
        "select stock_id, date from daily_prices where date >= :since and delivery_pct is null"), {"since": since})).all()))
    nifty_id = next((sid for sid, t, _ in stocks if t == "^NSEI"), None)

    seen_bhav, seen_index, added, filled, index_rows = set(), set(), 0, 0, 0
    async with httpx.AsyncClient(timeout=30, headers=HEADERS, follow_redirects=True) as client:
        for back in range(days, -1, -1):
            d = date.today() - timedelta(days=back)
            if d.weekday() >= 5:
                continue
            body = await _get(client, BHAV_URL.format(d=d))
            day, by_symbol = parse_bhav(body) if body else (None, {})
            if day and day not in seen_bhav:
                seen_bhav.add(day)
                new, fills = plan_appends(latest, day, by_symbol, ids, no_delivery)
                if new:
                    await db.execute(INSERT_PRICE, new)
                if fills:
                    await db.execute(text("update daily_prices set delivery_pct = :v where stock_id = :sid and date = :d and delivery_pct is null"), fills)
                added += len(new)
                filled += len(fills)

            body = await _get(client, INDEX_URL.format(d=d))
            day, by_index = parse_index_close(body) if body else (None, {})
            if day and day not in seen_index:
                seen_index.add(day)
                rows = [{"n": n, "d": day, **v} for n, v in by_index.items()]
                if rows:
                    await db.execute(text("""
                        insert into market_daily (index_name, date, close, pe, pb, div_yield)
                        values (:n, :d, :close, :pe, :pb, :div_yield)
                        on conflict (index_name, date) do update set close = excluded.close, pe = excluded.pe,
                          pb = excluded.pb, div_yield = excluded.div_yield"""), rows)
                    index_rows += len(rows)
                n50 = by_index.get("nifty 50")
                if nifty_id and n50:
                    new, _ = plan_appends(latest, day, {"^NSEI": {**n50, "volume": None, "delivery_pct": None}}, {"^NSEI": nifty_id})
                    if new:
                        await db.execute(INSERT_PRICE, [{k: r[k] for k in ("stock_id", "date", "open", "high", "low", "close", "volume", "delivery_pct")} for r in new])
                        added += len(new)
            await db.commit()
    return {"days": len(seen_bhav), "prices_added": added, "delivery_filled": filled, "index_rows": index_rows}
