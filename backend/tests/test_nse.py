"""Run: python tests/test_nse.py"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.nse_service import parse_delivery

SAMPLE = """SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
20MICRONS, EQ, 20-Nov-2026, 180.30, 180.00, 181.77, 177.72, 179.05, 179.49, 179.55, 34452, 61.86, 1470, 17830, 51.75
21STCENMGM, BE, 20-Nov-2026, 48.51, 47.00, 47.00, 46.09, 46.09, 46.09, 46.20, 6249, 2.89, 62, -, -
COALINDIA, EQ, 20-Nov-2026, 390.0, 391.0, 392.0, 385.0, 386.0, 386.2, 388.0, 100000, 386.2, 5000, 62000, 62.00
ODDONE, EQ, 20-Nov-2026, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -, -
"""
assert parse_delivery(SAMPLE) == {"20MICRONS": 51.75, "COALINDIA": 62.0}, parse_delivery(SAMPLE)
print("nse delivery: ok")
