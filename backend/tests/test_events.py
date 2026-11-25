"""Run: python tests/test_events.py"""
import os
import sys
from datetime import date

import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.events_service import events_from

cal = {"Ex-Dividend Date": date(2026, 11, 4), "Earnings Date": [date(2027, 2, 11)]}
divs = pd.Series([3.0, 5.25, 10.25], index=pd.to_datetime(["2019-05-01", "2026-09-04", "2026-11-04"]).tz_localize("Asia/Kolkata"))
splits = pd.Series([10.0], index=pd.to_datetime(["2024-01-01"]).tz_localize("Asia/Kolkata"))
rows = events_from(cal, divs, splits)
assert {"kind": "results", "event_date": date(2027, 2, 11), "amount": None} in rows
assert [r["amount"] for r in rows if r["kind"] == "dividend"] == [5.25, 10.25], "dividends before 2021 are dropped"
assert [r for r in rows if r["kind"] == "split"] == [{"kind": "split", "event_date": date(2024, 1, 1), "amount": 10.0}]
assert events_from(None, None, None) == []
print("events: ok")

from app.services.events_service import pick_results_dates
M = lambda sym, d, purpose, desc, ts: {"bm_symbol": sym, "bm_date": d, "bm_purpose": purpose, "bm_desc": desc, "bm_timestamp": ts}
meetings = [
    M("INFY", "15-Jan-2027", "Financial Results", "", "01-Dec-2026 10:00:00"),
    M("TCS", "09-Jan-2027", "Board Meeting Intimation", "to consider and approve the Financial results for the quarter", "01-Dec-2026 10:00:00"),
    M("TCS", "12-Jan-2027", "Board meeting Rescheduled", "Financial Results, rescheduled", "05-Dec-2026 10:00:00"),  # later notice wins
    M("ITC", "10-Dec-2026", "Fund Raising", "to consider raising funds", "01-Dec-2026 10:00:00"),          # not results
    M("HUL", "20-Nov-2026", "Financial Results", "", "01-Nov-2026 10:00:00"),                              # already past
    M("BAD", "someday", "Financial Results", "", "01-Nov-2026 10:00:00"),
]
assert pick_results_dates(meetings, date(2026, 11, 25)) == {"INFY": date(2027, 1, 15), "TCS": date(2027, 1, 12)}
assert pick_results_dates(None, date(2026, 11, 25)) == {}
print("results dates: ok")
