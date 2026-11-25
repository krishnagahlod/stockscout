"""Run: python tests/test_funds.py"""
import os
import sys
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.fund_service import fund_metrics, parse_navall

SAMPLE = """Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Large Cap Fund)

Axis Mutual Fund

1;INF1;-;Axis Bluechip Fund;Direct Plan;Growth Option;50.5;23-Nov-2026
2;INF2;-;Axis Bluechip Fund;Direct Plan;IDCW Option;20.1;23-Nov-2026
3;INF3;-;Axis Bluechip Fund;Regular Plan;Growth Option;45.0;23-Nov-2026
4;INF4;-;Old Style Fund - Direct Plan - Growth;;;12.0;23-Nov-2026
5;INF5;-;Stale Fund;Direct Plan;Growth Option;9.0;01-Jan-2024

Open Ended Schemes(Exchange Traded Funds (ETFs) - Gold ETF)

Nippon India Mutual Fund

6;INF6;-;Gold ETF;Direct Plan;Growth Option;80.0;23-Nov-2026

Close Ended Schemes(ELSS)

Some Mutual Fund

7;INF7;-;Closed Fund;Direct Plan;Growth Option;10.0;23-Nov-2026
"""

rows = parse_navall(SAMPLE, today=date(2026, 11, 24))
assert [r["scheme_code"] for r in rows] == [1, 4], rows
assert rows[0]["amc"] == "Axis Mutual Fund" and rows[0]["category"] == "Equity Scheme - Large Cap Fund"
assert rows[1]["name"] == "Old Style Fund", rows[1]["name"]
print("parse: ok")

end = date(2026, 11, 23)
pts = [(end - timedelta(weeks=w), 100.0) for w in range(300, 0, -1)] + [(end, 121.0)]
pts[100] = (pts[100][0], 50.0)  # a crash about 4 years ago, inside the 5-year window
m = fund_metrics(pts)
assert abs(m["ret_1y"] - 0.21) < 1e-9, m
assert abs((1 + m["ret_3y"]) ** 3 - 1.21) < 1e-9, m
assert abs((1 + m["ret_5y"]) ** 5 - 1.21) < 1e-9, m
assert fund_metrics(pts[-60:])["ret_3y"] is None, "under 3 years of history: no 3-year return"
assert abs(m["worst_fall_5y"] + 0.5) < 1e-9, m
print("metrics: ok")
