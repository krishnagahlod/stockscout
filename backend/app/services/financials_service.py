"""Weekly from Yahoo: yearly and quarterly results, and who owns the company (insiders vs institutions).
Fallback only: rows parsed from NSE filings (source = 'nse', filings_service.py) are never overwritten."""
import asyncio
import math
from datetime import date

import yfinance as yf
from loguru import logger
from sqlalchemy import text

INCOME = {"revenue": ["Total Revenue", "Operating Revenue"], "net_income": ["Net Income Common Stockholders", "Net Income"], "eps": ["Diluted EPS", "Basic EPS"]}
BALANCE = {"total_debt": ["Total Debt"], "equity": ["Common Stock Equity", "Stockholders Equity"]}
CASH = {"operating_cash_flow": ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"]}


def _pick(df, names, col):
    """First available, finite value among `names` for one period column of a yfinance statement."""
    if df is None or getattr(df, "empty", True) or col not in df.columns:
        return None
    for n in names:
        if n in df.index:
            v = df.at[n, col]
            try:
                v = float(v)
            except (TypeError, ValueError):
                continue
            if math.isfinite(v):
                return v
    return None


def financial_rows(income, q_income, balance, cashflow) -> list[dict]:
    rows = []
    for df, freq in ((income, "annual"), (q_income, "quarterly")):
        if df is None or getattr(df, "empty", True):
            continue
        for col in df.columns:
            row = {"freq": freq, "period_end": col.date() if hasattr(col, "date") else col}
            row.update({k: _pick(df, names, col) for k, names in INCOME.items()})
            extra = {**BALANCE, **CASH} if freq == "annual" else {}
            row.update({k: _pick(balance if k in BALANCE else cashflow, names, col) for k, names in extra.items()})
            for k in ("operating_cash_flow", "total_debt", "equity"):
                row.setdefault(k, None)
            if row["revenue"] is not None or row["net_income"] is not None:
                rows.append(row)
    return rows


def ownership_row(holders) -> dict | None:
    """yfinance major_holders frame (index: insidersPercentHeld, institutionsPercentHeld; column Value)."""
    try:
        vals = holders["Value"].to_dict()
    except Exception:
        return None
    ins, inst = vals.get("insidersPercentHeld"), vals.get("institutionsPercentHeld")
    if ins is None and inst is None:
        return None
    return {"insiders": ins, "institutions": inst}


def _fetch(symbol: str):
    t = yf.Ticker(symbol)
    return financial_rows(t.income_stmt, t.quarterly_income_stmt, t.balance_sheet, t.cashflow), ownership_row(t.major_holders)


async def sync_financials(db, pause: float = 0.3) -> dict:
    stocks = (await db.execute(text("select id, ticker from stocks where is_index_member"))).all()
    n_fin = n_own = 0
    today = date.today()
    for i, (sid, ticker) in enumerate(stocks):
        try:
            rows, own = await asyncio.to_thread(_fetch, ticker)
        except Exception as e:
            logger.warning(f"financials {ticker}: {e}")
            continue
        if rows:
            await db.execute(text("""
                insert into stock_financials (stock_id, freq, period_end, revenue, net_income, eps, operating_cash_flow, total_debt, equity, updated_at)
                values (:s, :freq, :period_end, :revenue, :net_income, :eps, :operating_cash_flow, :total_debt, :equity, now())
                on conflict (stock_id, freq, period_end) do update set revenue = excluded.revenue, net_income = excluded.net_income,
                  eps = excluded.eps, operating_cash_flow = coalesce(excluded.operating_cash_flow, stock_financials.operating_cash_flow),
                  total_debt = coalesce(excluded.total_debt, stock_financials.total_debt), equity = coalesce(excluded.equity, stock_financials.equity),
                  updated_at = now()
                where stock_financials.source = 'yahoo'"""), [{"s": sid, **r} for r in rows])
            n_fin += len(rows)
        if own:
            await db.execute(text("""
                insert into stock_ownership (stock_id, as_of, insiders, institutions) values (:s, :d, :insiders, :institutions)
                on conflict (stock_id, as_of) do update set insiders = excluded.insiders, institutions = excluded.institutions"""),
                {"s": sid, "d": today, **own})
            n_own += 1
        await db.commit()
        if i % 100 == 0:
            logger.info(f"financials: {i}/{len(stocks)}")
        await asyncio.sleep(pause)
    return {"financial_rows": n_fin, "ownership": n_own}
