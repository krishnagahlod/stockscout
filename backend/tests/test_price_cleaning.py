"""Run: python tests/test_price_cleaning.py"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from datetime import date, timedelta

from app.services.price_cleaning import plan_cleaning

D0 = date(2026, 1, 1)


def d(i):
    return D0 + timedelta(days=i)


def series(closes):
    return [(d(i), c) for i, c in enumerate(closes)]


# 1-for-10 split that Yahoo didn't adjust: everything before d03 should be divided by 10
bad, splits = plan_cleaning(series([100, 102, 101, 10.2, 10.4, 10.3]))
assert bad == set(), bad
assert len(splits) == 1 and splits[0][0] == d(3) and abs(splits[0][1] - 0.101) < 0.001, splits

# a two-day spike that comes back is a bad tick, not a split
bad, splits = plan_cleaning(series([100, 101, 1000, 1010, 102, 103]))
assert bad == {d(2), d(3)}, bad
assert splits == [], splits

# normal moves are left alone
bad, splits = plan_cleaning(series([100, 95, 110, 104, 120, 70]))
assert bad == set() and splits == [], (bad, splits)

# a split after a bad tick compares against the last good close
bad, splits = plan_cleaning(series([100, 900, 101, 50.5, 51]))
assert bad == {d(1)} and splits[0][0] == d(3) and abs(splits[0][1] - 0.5) < 0.01, (bad, splits)

print("price cleaning: ok")

# a big move across a months-long data hole is not treated as a split
bad, splits = plan_cleaning([(d(0), 70.0), (d(1), 69.7), (d(150), 218.0), (d(151), 217.9)])
assert bad == set() and splits == [], (bad, splits)
print("gap check: ok")
