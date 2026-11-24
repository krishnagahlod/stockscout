"""Run: python tests/test_features.py"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.feature_service import compute_technical_indicators

# A high of 200 more than a year ago must not count: within the last 252 days the worst fall is 120 -> 90.
closes = [200.0] * 10 + [100.0] * 300 + [120.0] * 50 + [90.0] * 20 + [110.0] * 20
idx = pd.date_range("2024-01-01", periods=len(closes), freq="B")
df = pd.DataFrame({"open": closes, "high": closes, "low": closes, "close": closes, "volume": [1000] * len(closes)}, index=idx)
dd = compute_technical_indicators(df)["max_drawdown_1y"].iloc[-1]
assert np.isclose(dd, 90 / 120 - 1), dd
print("max drawdown 1y: ok")
