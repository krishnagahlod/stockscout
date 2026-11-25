"""Institutional money flows: daily FII/DII buying and selling from NSE, monthly foreign investment from NSDL."""
import re
from datetime import date, datetime

from loguru import logger
from sqlalchemy import text

NSDL_URL = "https://www.fpi.nsdl.co.in/web/Reports/Yearwise.aspx?RptType=6"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
CATEGORY = {"FII/FPI": "fii", "DII": "dii"}


def _num(v):
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def parse_fiidii(rows: list) -> list[dict]:
    """NSE fiidiiTradeReact rows -> {date, category, buy, sell, net}; unknown categories and bad dates are dropped."""
    out = []
    for r in rows or []:
        cat = CATEGORY.get(r.get("category"))
        try:
            d = datetime.strptime(r.get("date", ""), "%d-%b-%Y").date()
        except ValueError:
            continue
        net = _num(r.get("netValue"))
        if cat and net is not None:
            out.append({"date": d, "category": cat, "buy": _num(r.get("buyValue")), "sell": _num(r.get("sellValue")), "net": net})
    return out


def parse_nsdl_year(html: str) -> list[dict]:
    """NSDL's 'Monthly FPI Net Investments' page for one calendar year -> {month, equity}. Equity is the first column."""
    m = re.search(r"Calendar Year - (\d{4})", html)
    if not m:
        return []
    year = int(m.group(1))
    cells = [c.strip() for c in re.findall(r"<td[^>]*>([^<]*)</td>", html)]
    out = []
    for i, c in enumerate(cells[:-1]):
        if c in MONTHS:
            v = _num(cells[i + 1])
            if v is not None:
                out.append({"month": date(year, MONTHS.index(c) + 1, 1), "equity": v})
    return out


async def _nsdl_years(years: list[int]) -> list[dict]:
    from curl_cffi.requests import AsyncSession
    out = []
    async with AsyncSession(impersonate="chrome", timeout=30) as s:
        page = (await s.get(NSDL_URL)).text
        for y in years:
            form = dict(re.findall(r'name="(__[A-Z]+)"[^>]*value="([^"]*)"', page))
            form.update({"__EVENTTARGET": "ddl", "__EVENTARGUMENT": "", "ddl": str(y)})
            page = (await s.post(NSDL_URL, data=form)).text
            rows = parse_nsdl_year(page)
            if not rows or rows[0]["month"].year != y:
                raise RuntimeError(f"NSDL page for {y} not understood")
            out += rows
    return out


async def sync_flows(db, years: list[int] | None = None) -> dict:
    """Store the latest day's FII/DII flows (NSE) and the monthly FPI figures for `years` (default: this year and last)."""
    from app.services.filings_service import Nse
    result = {}
    nse = Nse()
    try:
        rows = parse_fiidii(await nse.get("fiidiiTradeReact"))
        if rows:
            await db.execute(text("""
                insert into fund_flows (date, category, buy, sell, net) values (:date, :category, :buy, :sell, :net)
                on conflict (date, category) do update set buy = excluded.buy, sell = excluded.sell, net = excluded.net"""), rows)
            await db.commit()
        result["daily"] = rows[0]["date"].isoformat() if rows else None
    except Exception as e:
        logger.warning(f"fii/dii flows: {e}")
        await db.rollback()
    finally:
        await nse.close()

    today = date.today()
    try:
        months = await _nsdl_years(years or [today.year - 1, today.year])
        # NSDL lists completed months; a month already stored is updated if NSDL revises it
        if months:
            await db.execute(text("""
                insert into fpi_monthly (month, equity) values (:month, :equity)
                on conflict (month) do update set equity = excluded.equity"""), months)
            await db.commit()
        result["months"] = len(months)
    except Exception as e:
        logger.warning(f"nsdl fpi: {e}")
        await db.rollback()
    return result
