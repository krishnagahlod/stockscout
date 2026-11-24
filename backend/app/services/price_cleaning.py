"""
Repair Yahoo daily prices in place: drop NaN rows and short-lived bad ticks, and back-adjust
splits and bonus issues that Yahoo left unadjusted (a one-day ÷10 that never comes back).

Safe to run every night: once a jump is adjusted it is gone, and the price sync only appends
days after the latest stored one, so nothing is adjusted twice.
"""
import math

from loguru import logger
from sqlalchemy import text

JUMP = math.log(1.8)     # a one-day move beyond x1.8 or /1.8 is suspicious for Nifty 500 names and ETFs
REVERT = math.log(1.15)  # back within 15% of the pre-jump close within WINDOW days = a bad tick
WINDOW = 5
MAX_GAP_DAYS = 7         # only compare neighbouring trading days; across a data hole we can't tell a split from a move


def plan_cleaning(rows: list[tuple]) -> tuple[set, list[tuple]]:
    """
    rows: (date, close) sorted by date (datetime.date), closes > 0.
    Returns (bad_dates, splits): rows to delete, and (date, ratio) pairs meaning
    "multiply every price before `date` by `ratio`".
    shortcut: a genuine one-day crash beyond ~45% would be treated as a split; switch to NSE
    corporate-action files (bhavcopy) before going public.
    """
    bad: set = set()
    splits: list[tuple] = []
    n = len(rows)
    prev, i = 0, 1
    while i < n:
        gap = (rows[i][0] - rows[prev][0]).days
        if gap <= MAX_GAP_DAYS and abs(math.log(rows[i][1] / rows[prev][1])) > JUMP:
            back = next((j for j in range(i + 1, min(n, i + 1 + WINDOW))
                         if abs(math.log(rows[j][1] / rows[prev][1])) < REVERT), None)
            if back is not None:
                bad.update(rows[m][0] for m in range(i, back))
                i = back
                continue
            splits.append((rows[i][0], rows[i][1] / rows[prev][1]))
        prev = i
        i += 1
    return bad, splits


async def clean_prices(db, days: int | None = 30) -> dict:
    """
    Apply plan_cleaning to stored prices. Nightly, only the last `days` are scanned (new splits only appear
    in new data; the adjustment still reaches all earlier history). days=None scans everything.
    """
    nan = await db.execute(text("delete from daily_prices where close = 'NaN' or close <= 0"))
    window = "" if days is None else f"where date >= current_date - {int(days)}"
    result = await db.execute(text(f"select stock_id, date, close from daily_prices {window} order by stock_id, date"))
    by_stock: dict[int, list] = {}
    for sid, d, c in result:
        by_stock.setdefault(sid, []).append((d, float(c)))

    bad_total, split_total = 0, 0
    for sid, rows in by_stock.items():
        bad, splits = plan_cleaning(rows)
        if bad:
            await db.execute(text("delete from daily_prices where stock_id = :s and date = any(:d)"), {"s": sid, "d": list(bad)})
        for d, ratio in splits:
            await db.execute(text(
                "update daily_prices set open = open * :r, high = high * :r, low = low * :r, close = close * :r, "
                "adj_close = adj_close * :r, volume = round(volume / :r) where stock_id = :s and date < :d"),
                {"r": ratio, "s": sid, "d": d})
            logger.info(f"price cleaning: stock {sid} adjusted x{ratio:.4f} before {d}")
        bad_total += len(bad)
        split_total += len(splits)
    await db.commit()
    return {"nan_rows": nan.rowcount, "bad_ticks": bad_total, "splits": split_total}
