"""Run: python tests/test_financials.py"""
import os
import sys
from datetime import date

import numpy as np
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.financials_service import financial_rows, ownership_row

cols = [pd.Timestamp("2026-03-31"), pd.Timestamp("2025-03-31")]
income = pd.DataFrame({cols[0]: [1000.0, 200.0, 12.5], cols[1]: [900.0, np.nan, 11.0]}, index=["Total Revenue", "Net Income", "Diluted EPS"])
balance = pd.DataFrame({cols[0]: [50.0, 800.0]}, index=["Total Debt", "Common Stock Equity"])
cash = pd.DataFrame({cols[0]: [150.0]}, index=["Operating Cash Flow"])
q = pd.DataFrame({pd.Timestamp("2026-09-30"): [260.0, 52.0, 3.2]}, index=["Total Revenue", "Net Income", "Diluted EPS"])

rows = financial_rows(income, q, balance, cash)
a26 = next(r for r in rows if r["freq"] == "annual" and r["period_end"] == date(2026, 3, 31))
assert a26 == {"freq": "annual", "period_end": date(2026, 3, 31), "revenue": 1000.0, "net_income": 200.0, "eps": 12.5,
               "total_debt": 50.0, "equity": 800.0, "operating_cash_flow": 150.0}, a26
a25 = next(r for r in rows if r["period_end"] == date(2025, 3, 31))
assert a25["net_income"] is None and a25["total_debt"] is None, "NaN and missing columns become None"
assert [r for r in rows if r["freq"] == "quarterly"][0]["revenue"] == 260.0
assert financial_rows(None, None, None, None) == []

holders = pd.DataFrame({"Value": {"insidersPercentHeld": 0.61, "institutionsPercentHeld": 0.28, "institutionsCount": 184.0}})
assert ownership_row(holders) == {"insiders": 0.61, "institutions": 0.28}
assert ownership_row(None) is None
print("financials: ok")
