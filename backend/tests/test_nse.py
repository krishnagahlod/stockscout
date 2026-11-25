"""Run: python tests/test_nse.py"""
import os
import sys
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.nse_service import parse_bhav, parse_index_close, plan_appends

SAMPLE = """SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
20MICRONS, EQ, 20-Nov-2026, 180.30, 180.00, 181.77, 177.72, 179.05, 179.49, 179.55, 34452, 61.86, 1470, 17830, 51.75
21STCENMGM, BE, 20-Nov-2026, 48.51, 47.00, 47.00, 46.09, 46.09, 46.09, 46.20, 6249, 2.89, 62, -, -
COALINDIA, EQ, 20-Nov-2026, 390.0, 391.0, 392.0, 385.0, 386.0, 386.2, 388.0, 100000, 386.2, 5000, 62000, 62.00
GOV1, GS, 20-Nov-2026, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -, -
"""
day, rows = parse_bhav(SAMPLE)
assert day == date(2026, 11, 20)
assert set(rows) == {"20MICRONS", "21STCENMGM", "COALINDIA"}, rows
assert rows["COALINDIA"] == {"open": 391.0, "high": 392.0, "low": 385.0, "close": 386.2, "volume": 100000, "delivery_pct": 62.0}
assert rows["21STCENMGM"]["delivery_pct"] is None

INDEX = """Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%),Volume,Turnover (Rs. Cr.),P/E,P/B,Div Yield
Nifty 50,20-11-2026,25368,25808.8,25345.2,25800.6,286.3,1.12,428344270,42565.93,21.02,3.17,1.32
Nifty50 Shariah,20-11-2026,1,1,1,1,0,0,0,0,1,1,1
India VIX,20-11-2026,12.1,12.5,11.8,12.0,-0.1,-1,-,-,-,-,-
"""
day, idx = parse_index_close(INDEX)
assert day == date(2026, 11, 20) and set(idx) == {"nifty 50", "india vix"}, idx
assert idx["nifty 50"]["pe"] == 21.02 and idx["india vix"]["pe"] is None

# append-only: stock 1 is behind (gets the new day), stock 2 already has it (only its missing delivery % is filled)
latest = {1: date(2026, 11, 19), 2: date(2026, 11, 20)}
new, fills = plan_appends(latest, date(2026, 11, 20), rows, {"COALINDIA": 1, "20MICRONS": 2}, {(2, date(2026, 11, 20))})
assert [r["stock_id"] for r in new] == [1] and latest[1] == date(2026, 11, 20)
assert fills == [{"sid": 2, "d": date(2026, 11, 20), "v": 51.75}]
# the same day again (a holiday re-publish) adds nothing
new, fills = plan_appends(latest, date(2026, 11, 20), rows, {"COALINDIA": 1, "20MICRONS": 2})
assert new == [] and fills == []
print("nse: ok")
