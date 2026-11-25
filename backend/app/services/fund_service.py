"""
Mutual funds from AMFI's free daily NAV file (portal.amfiindia.com/spages/NAVAll.txt).
One row per open-ended fund, Direct plan, Growth option; ETFs are excluded (they are in `stocks`).
"""
import math
import re
from datetime import date, datetime, timedelta

import httpx
from loguru import logger
from sqlalchemy import text

AMFI_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"
_DIRECT_SUFFIX = re.compile(r"\s*[-–(]+\s*direct\b.*$", re.IGNORECASE)


def parse_navall(body: str, today: date | None = None) -> list[dict]:
    """Rows for open-ended Direct-Growth funds with a NAV from the last 30 days."""
    today = today or date.today()
    section = category = amc = None
    out = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < 6:
            if "(" in line and line.split("(")[0].strip().endswith("Schemes"):
                section = line.split("(")[0].strip()
                category = line[line.find("(") + 1: line.rfind(")")].strip()
            else:
                amc = line
            continue
        if parts[0] == "Scheme Code" or section != "Open Ended Schemes" or "ETF" in (category or ""):
            continue
        code, isin, _, name = parts[:4]
        plan, option, nav, day = (parts[4], parts[5], parts[6], parts[7]) if len(parts) >= 8 else ("", "", parts[4], parts[5])
        label = f"{name} {plan} {option}".lower()
        if "direct" not in label or "growth" not in label or re.search(r"idcw|dividend|bonus", label):
            continue
        try:
            nav_f = float(nav)
            nav_date = datetime.strptime(day, "%d-%b-%Y").date()
        except ValueError:
            continue
        if nav_f <= 0 or (today - nav_date).days > 30:
            continue
        out.append({
            "scheme_code": int(code), "isin": isin if isin not in ("-", "") else None,
            "name": _DIRECT_SUFFIX.sub("", name).strip(), "amc": amc, "category": category,
            "nav": nav_f, "nav_date": nav_date,
        })
    return out


def fund_metrics(points: list[tuple]) -> dict:
    """points: (date, nav) ascending. Returns 1y simple return, 3y/5y yearly returns, worst fall over 5 years."""
    if len(points) < 2:
        return {"ret_1y": None, "ret_3y": None, "ret_5y": None, "worst_fall_5y": None}
    last_d, last_v = points[-1]

    def back(years):
        cut = last_d.replace(year=last_d.year - years) if not (last_d.month == 2 and last_d.day == 29) else last_d - timedelta(days=365 * years)
        before = [v for d, v in points if d <= cut]
        # shortcut: history is weekly beyond 30 days, so the start NAV can be up to 6 days early
        return before[-1] if before and (cut - max(d for d, _ in points if d <= cut)).days <= 10 else None

    def yearly(years):
        start = back(years)
        return (last_v / start) ** (1 / years) - 1 if start else None

    start1 = back(1)
    five = [v for d, v in points if d >= last_d - timedelta(days=365 * 5 + 2)]
    peak, worst = five[0], 0.0
    for v in five:
        peak = max(peak, v)
        worst = min(worst, v / peak - 1)
    return {"ret_1y": last_v / start1 - 1 if start1 else None, "ret_3y": yearly(3), "ret_5y": yearly(5), "worst_fall_5y": worst}


async def sync_funds(db) -> dict:
    """Nightly: today's NAVs, thin old history to weekly, recompute returns."""
    async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "StockScout/1.0"}) as client:
        resp = await client.get(AMFI_URL)
        resp.raise_for_status()
    rows = parse_navall(resp.text)
    if len(rows) < 500:  # a broken or partial file should not wipe anything
        raise RuntimeError(f"AMFI file looks incomplete ({len(rows)} funds)")

    await db.execute(text("""
        insert into funds (scheme_code, isin, name, amc, category, nav, nav_date, updated_at)
        values (:scheme_code, :isin, :name, :amc, :category, :nav, :nav_date, now())
        on conflict (scheme_code) do update set isin = excluded.isin, name = excluded.name, amc = excluded.amc,
          category = excluded.category, nav = excluded.nav, nav_date = excluded.nav_date, updated_at = now()"""), rows)
    await db.execute(text("""
        insert into fund_nav (scheme_code, date, nav) values (:scheme_code, :nav_date, :nav)
        on conflict (scheme_code, date) do update set nav = excluded.nav"""), rows)
    # keep daily NAVs for 30 days, then one per week (the last of each week)
    await db.execute(text("""
        delete from fund_nav f where f.date < current_date - 30 and exists (
          select 1 from fund_nav g where g.scheme_code = f.scheme_code and g.date > f.date
            and date_trunc('week', g.date) = date_trunc('week', f.date))"""))
    await db.commit()
    updated = await refresh_fund_metrics(db)
    return {"funds": len(rows), "metrics": updated}


async def refresh_fund_metrics(db) -> int:
    result = await db.execute(text("select scheme_code, date, nav from fund_nav order by scheme_code, date"))
    by_fund: dict[int, list] = {}
    for code, d, nav in result:
        by_fund.setdefault(code, []).append((d, float(nav)))
    params = []
    for code, pts in by_fund.items():
        m = fund_metrics(pts)
        params.append({"code": code, **{k: (None if v is None or not math.isfinite(v) else v) for k, v in m.items()}})
    if params:
        await db.execute(text("""
            update funds set ret_1y = :ret_1y, ret_3y = :ret_3y, ret_5y = :ret_5y, worst_fall_5y = :worst_fall_5y
            where scheme_code = :code"""), params)
        await db.commit()
    logger.info(f"fund metrics refreshed for {len(params)} funds")
    return len(params)
