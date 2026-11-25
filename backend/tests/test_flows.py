"""Run: python tests/test_flows.py"""
import os
import sys
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.flows_service import parse_fiidii, parse_nsdl_year

NSE = [
    {"buyValue": "16505.75", "category": "DII", "date": "23-Nov-2026", "netValue": "-2760.12", "sellValue": "19265.87"},
    {"buyValue": "23473.67", "category": "FII/FPI", "date": "23-Nov-2026", "netValue": "5672.99", "sellValue": "17800.68"},
    {"buyValue": "1", "category": "Other", "date": "23-Nov-2026", "netValue": "1", "sellValue": "0"},
    {"buyValue": "1", "category": "DII", "date": "-", "netValue": "1", "sellValue": "0"},
]
rows = parse_fiidii(NSE)
assert len(rows) == 2, rows
assert rows[0] == {"date": date(2026, 11, 23), "category": "dii", "buy": 16505.75, "sell": 19265.87, "net": -2760.12}
assert rows[1]["category"] == "fii" and rows[1]["net"] == 5672.99
assert parse_fiidii(None) == []

# trimmed from NSDL's yearly page: equity is the first column after the month; Total row ignored
HTML = """<span>Monthly FPI Net Investments (Calendar Year - 2020)</span><table>
<tr><td>Calendar Year</td><td>Equity</td><td>Debt</td><td>Total</td></tr>
<tr><td>January</td><td>12123</td><td>-11648</td><td>957</td></tr>
<tr><td>March</td><td>-61,973</td><td>-60376</td><td>-118203</td></tr>
<tr><td>April</td><td> </td><td>1</td><td>1</td></tr>
<tr><td>Total</td><td>1</td><td>2</td><td>3</td></tr></table>"""
months = parse_nsdl_year(HTML)
assert months == [{"month": date(2020, 1, 1), "equity": 12123.0}, {"month": date(2020, 3, 1), "equity": -61973.0}], months
assert parse_nsdl_year("<td>January</td><td>5</td>") == []  # no year heading: not understood
print("flows tests passed")
