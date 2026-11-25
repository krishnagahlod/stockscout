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
