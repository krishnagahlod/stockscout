from datetime import date

import pandas as pd

from app.models.strategy_schemas import StrategyRules
from app.services.backtest_service import PortfolioBacktester


def _bt():
    rules = StrategyRules.model_validate({"name": "t", "filters": [{"metric": "roe", "op": ">", "value": 0.1}]})
    bt = PortfolioBacktester(rules, date(2024, 1, 1), date(2024, 12, 31))
    days = pd.date_range("2023-01-02", periods=500, freq="B")
    bt.prices = {"AAA.NS": pd.DataFrame({"open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 1}, index=days)}
    bt.stock_map = {"AAA.NS": {"id": 1, "market_cap": 1000}}
    bt.fundamentals = {"AAA.NS": pd.DataFrame({"roe": [0.3]}, index=pd.DatetimeIndex([pd.Timestamp("2024-06-01")]))}
    return bt


def test_no_lookahead_on_fundamentals():
    bt = _bt()
    assert bt._get_metric_at_date("AAA.NS", "roe", pd.Timestamp("2024-03-01")) is None  # published later
    assert bt._get_metric_at_date("AAA.NS", "roe", pd.Timestamp("2024-07-01")) == 0.3


def test_no_silent_fallback_when_nothing_matches():
    bt = _bt()
    assert bt._select_stocks_at_date(pd.Timestamp("2024-03-01")) == {}
    assert bt.empty_rebalances == 1
