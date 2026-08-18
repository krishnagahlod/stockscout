"""Portfolio-level backtesting engine.

Simulates a rebalanced portfolio over time using the rule engine to
select stocks at each rebalance date, with transaction costs and slippage.
"""

import json
import math
import operator
from datetime import date, datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from collections import defaultdict
from loguru import logger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.db_models import Stock, DailyPrice, Strategy, BacktestResult, Fundamental, IndexConstituent
from app.models.strategy_schemas import StrategyRules, FilterCondition
from app.models.backtest_schemas import (
    BacktestRequest,
    BacktestResponse,
    BacktestMetrics,
    EquityCurvePoint,
    TradeRecord,
    MonthlyReturn,
    HoldingSnapshot,
)
from app.services.backtest_metrics import compute_metrics, compute_monthly_returns, compute_trade_stats
from app.services.rule_engine import LOWER_IS_BETTER_METRICS

OPS = {
    ">": operator.gt,
    "<": operator.lt,
    ">=": operator.ge,
    "<=": operator.le,
    "==": operator.eq,
}

REBALANCE_FREQ = {
    "monthly": 21,        # ~1 month of trading days
    "quarterly": 63,      # ~3 months
    "semi_annual": 126,   # ~6 months
    "annual": 252,         # ~1 year
}


class PortfolioBacktester:
    """Simulate a rebalanced portfolio from strategy rules."""

    def __init__(
        self,
        rules: StrategyRules,
        start_date: date,
        end_date: date,
        initial_capital: float = 1_000_000,
        tx_cost_bps: float = 20.0,
        slippage_bps: float = 10.0,
        rebalance_frequency: str = "quarterly",
    ):
        self.rules = rules
        self.start_date = start_date
        self.end_date = end_date
        self.initial_capital = initial_capital
        self.tx_cost_pct = tx_cost_bps / 10_000
        self.slippage_pct = slippage_bps / 10_000
        self.rebalance_freq = REBALANCE_FREQ.get(rebalance_frequency, 63)

        # Internal state
        self.prices: dict[str, pd.DataFrame] = {}  # symbol -> OHLCV df
        self.fundamentals: dict[str, dict] = {}     # symbol -> fundamental values
        self.stock_map: dict[str, dict] = {}        # symbol -> {id, name, sector, market_cap}
        self.trading_dates: pd.DatetimeIndex = pd.DatetimeIndex([])

    async def load_data(self, db: AsyncSession):
        """Load all needed price and fundamental data from DB."""
        # Load prices with a lookback window before start_date so that
        # technical metrics (momentum_12m needs 252 days, sma_200 needs 200 days)
        # can be computed from the first day of the backtest.
        lookback_start = self.start_date - timedelta(days=400)  # ~252 trading days + buffer

        # Load stocks
        if getattr(self.rules, 'strategy_type', None) == 'custom':
            custom_symbols = [s.symbol for s in getattr(self.rules, 'stocks', [])]
            result = await db.execute(select(Stock).where(Stock.symbol.in_(custom_symbols)))
        else:
            result = await db.execute(select(Stock))
        stocks = result.scalars().all()
        stock_ids = [s.id for s in stocks]

        for stock in stocks:
            self.stock_map[stock.symbol] = {
                "id": stock.id,
                "name": stock.name,
                "sector": stock.sector,
                "market_cap": stock.market_cap_cr,
            }

        # Load index memberships for survivorship bias free universe
        self.index_memberships = defaultdict(list)
        if getattr(self.rules, 'strategy_type', None) != 'custom':
            ic_result = await db.execute(
                select(IndexConstituent)
                .where(IndexConstituent.index_name == self.rules.universe)
                .where(IndexConstituent.stock_id.in_(stock_ids))
            )
            for ic in ic_result.scalars().all():
                self.index_memberships[ic.stock_id].append({
                    "added_date": pd.Timestamp(ic.added_date),
                    "removed_date": pd.Timestamp(ic.removed_date) if ic.removed_date else pd.Timestamp.max
                })

        # Bulk load prices with lookback (optimised column fetch)
        price_result = await db.execute(
            select(
                DailyPrice.stock_id,
                DailyPrice.date,
                DailyPrice.open,
                DailyPrice.high,
                DailyPrice.low,
                DailyPrice.close,
                DailyPrice.volume,
            )
            .where(
                and_(
                    DailyPrice.stock_id.in_(stock_ids),
                    DailyPrice.date >= lookback_start,
                    DailyPrice.date <= self.end_date,
                )
            )
            .order_by(DailyPrice.date.asc())
        )
        price_rows = price_result.all()
        
        # Group prices by stock_id
        prices_by_stock = {}
        for r in price_rows:
            sid, d_date, d_open, d_high, d_low, d_close, d_vol = r
            if sid not in prices_by_stock:
                prices_by_stock[sid] = []
            prices_by_stock[sid].append({
                "date": d_date,
                "open": d_open,
                "high": d_high,
                "low": d_low,
                "close": d_close,
                "volume": d_vol,
            })
            
        import asyncio
        
        def _build_dataframes(stocks, prices_by_stock):
            prices_dict = {}
            import pandas as pd
            for stock in stocks:
                if stock.id in prices_by_stock:
                    df = pd.DataFrame(prices_by_stock[stock.id])
                    df["date"] = pd.to_datetime(df["date"])
                    df = df.set_index("date").sort_index()
                    prices_dict[stock.symbol] = df
            return prices_dict

        self.prices = await asyncio.to_thread(_build_dataframes, stocks, prices_by_stock)

        # Bulk load historical fundamentals
        fund_result = await db.execute(
            select(Fundamental)
            .where(Fundamental.stock_id.in_(stock_ids))
            .order_by(Fundamental.stock_id, Fundamental.as_of_date.asc())
        )
        fund_rows = fund_result.scalars().all()
        
        fund_by_stock = defaultdict(list)
        for f in fund_rows:
            fund_by_stock[f.stock_id].append(f)
            
        def _build_fund_dataframes(stocks_list, funds_dict):
            dfs = {}
            for stock in stocks_list:
                rows = funds_dict.get(stock.id)
                if not rows:
                    continue
                records = []
                for r in rows:
                    records.append({
                        "as_of_date": pd.Timestamp(r.as_of_date),
                        "trailing_pe": r.pe,
                        "price_to_book": r.pb,
                        "ev_to_ebitda": r.ebitda,
                        "dividend_yield": r.dividend_yield,
                        "roe": r.roe,
                        "roa": r.roce,
                        "debt_to_equity": r.debt_to_equity,
                        "gross_margin": r.gross_margin,
                        "operating_margin": r.operating_margin,
                        "net_margin": r.net_margin,
                        "eps": r.eps,
                        "revenue": r.revenue,
                        "market_cap": r.market_cap,
                    })
                df = pd.DataFrame.from_records(records)
                df.set_index("as_of_date", inplace=True)
                dfs[stock.symbol] = df
            return dfs
            
        self.fundamentals = await asyncio.to_thread(_build_fund_dataframes, stocks, fund_by_stock)

        # Build common trading date index from all loaded prices
        all_dates = set()
        for df in self.prices.values():
            all_dates.update(df.index)
        if all_dates:
            self.trading_dates = pd.DatetimeIndex(sorted(all_dates))

        logger.info(
            f"Loaded data: {len(self.prices)} stocks with prices, "
            f"{len(self.fundamentals)} with fundamentals, "
            f"{len(self.trading_dates)} trading days"
        )

    def _get_metric_at_date(self, symbol: str, metric: str, as_of: pd.Timestamp) -> Optional[float]:
        """Get a metric value for a stock at a given date.

        Technical metrics are computed from price history up to as_of.
        Fundamental metrics use stored values (acknowledged limitation).
        """
        df = self.prices.get(symbol)
        if df is None:
            return None

        # O(log N) lookup instead of O(N) boolean indexing
        idx = df.index.searchsorted(as_of, side='right')
        if idx == 0:
            return None
            
        prices_up_to = df.iloc[:idx]
        close = prices_up_to["close"]

        # Stock-level
        if metric == "market_cap":
            return self.stock_map.get(symbol, {}).get("market_cap")

        # Fundamental metrics (Point-in-Time)
        fund_metrics = {
            "trailing_pe", "price_to_book", "ev_to_ebitda", "dividend_yield",
            "roe", "roa", "debt_to_equity", "gross_margin", "operating_margin",
            "net_margin", "eps", "revenue", "market_cap",
        }
        if metric in fund_metrics:
            fund_df = self.fundamentals.get(symbol)
            if fund_df is None or fund_df.empty:
                return None
            f_idx = fund_df.index.searchsorted(as_of, side='right')
            if f_idx == 0:
                val = fund_df.iloc[0].get(metric)
            else:
                val = fund_df.iloc[f_idx - 1].get(metric)
            return float(val) if not pd.isna(val) else None

        # Technical metrics (computed from price data up to as_of)
        n = len(close)

        if metric == "sma_50":
            return float(close.iloc[-50:].mean()) if n >= 50 else None
        if metric == "sma_200":
            return float(close.iloc[-200:].mean()) if n >= 200 else None
        if metric == "rsi_14":
            return self._compute_rsi(close, 14)
        if metric == "momentum_12m":
            if n >= 252:
                return float(close.iloc[-1] / close.iloc[-252] - 1)
            elif n >= 60:
                # Annualize shorter momentum if we have at least ~3 months
                raw = close.iloc[-1] / close.iloc[0] - 1
                annualized = (1 + raw) ** (252 / n) - 1
                return float(annualized)
            return None
        if metric in ("volatility_30d", "volatility_90d"):
            window = 30 if "30" in metric else 90
            if n < window + 1:
                return None
            returns = close.pct_change().dropna().iloc[-window:]
            return float(returns.std() * np.sqrt(252))
        if metric == "beta":
            return 1.0  # Default market beta to 1.0 for filter evaluation
        if metric == "max_drawdown_1y":
            if n < 252:
                return None
            last_year = close.iloc[-252:]
            cummax = last_year.cummax()
            dd = (last_year - cummax) / cummax
            return float(dd.min())
        if metric == "sharpe_trailing":
            if n < 252:
                return None
            returns = close.pct_change().dropna().iloc[-252:]
            daily_rf = settings.RISK_FREE_RATE / 252
            excess = returns - daily_rf
            if returns.std() == 0:
                return 0
            return float(excess.mean() / returns.std() * np.sqrt(252))

        return None

    @staticmethod
    def _compute_rsi(close: pd.Series, period: int = 14) -> Optional[float]:
        if len(close) < period + 1:
            return None
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta.clip(upper=0))
        avg_gain = gain.rolling(period).mean()
        avg_loss = loss.rolling(period).mean()
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        val = rsi.iloc[-1]
        return float(val) if not math.isnan(val) else None

    def _get_custom_weights(self, as_of: pd.Timestamp) -> dict[str, float]:
        """Return fixed weights for custom portfolio stocks."""
        stocks = getattr(self.rules, 'stocks', [])
        if not stocks:
            return {}
        
        symbols = [s.symbol for s in stocks]
        weights = {}
        
        position_sizing = getattr(self.rules, "position_sizing", "equal")
        if position_sizing == "custom":
            for s in stocks:
                weights[s.symbol] = s.weight if s.weight is not None else 1.0 / len(symbols)
        elif position_sizing == "inverse_volatility":
            inv_vols = {}
            for sym in symbols:
                vol = self._get_metric_at_date(sym, "volatility_90d", as_of)
                if not vol:
                    vol = self._get_metric_at_date(sym, "volatility_30d", as_of)
                if not vol or vol <= 0:
                    vol = 0.30
                inv_vols[sym] = 1.0 / vol
            total_inv_vol = sum(inv_vols.values())
            for sym, iv in inv_vols.items():
                weights[sym] = iv / total_inv_vol if total_inv_vol > 0 else 1.0 / len(symbols)
        else:
            for sym in symbols:
                weights[sym] = 1.0 / len(symbols)
                
        return weights

    def _select_stocks_at_date(self, as_of: pd.Timestamp) -> dict[str, float]:
        """Apply strategy filters at a given date and return selected symbols."""
        if getattr(self.rules, 'strategy_type', None) == 'custom':
            return self._get_custom_weights(as_of)

        candidates = []
        skipped_no_data = 0
        skipped_none_metric = 0

        for symbol in self.prices:
            stock_info = self.stock_map.get(symbol)
            if not stock_info:
                continue
                
            # Check if stock was in universe on this date (Survivorship bias fix)
            memberships = self.index_memberships.get(stock_info["id"], [])
            is_member = False
            for m in memberships:
                if m["added_date"] <= as_of <= m["removed_date"]:
                    is_member = True
                    break
            # Fallback if no membership data, assume always in universe
            if not memberships:
                is_member = True
                
            if not is_member:
                continue

            # Check stock has data up to this date
            df = self.prices[symbol]
            idx = df.index.searchsorted(as_of, side='right')
            if idx == 0:
                skipped_no_data += 1
                continue

            # Check all filters
            passes = True
            metric_vals = {}
            for condition in self.rules.filters:
                val = self._get_metric_at_date(symbol, condition.metric, as_of)
                if val is None:
                    passes = False
                    skipped_none_metric += 1
                    break
                op_fn = OPS.get(condition.op)
                if op_fn is None:
                    passes = False
                    break

                cond_val = condition.value
                if isinstance(cond_val, list):
                    # between
                    if not (cond_val[0] <= val <= cond_val[1]):
                        passes = False
                        break
                else:
                    if not op_fn(val, cond_val):
                        passes = False
                        break

                metric_vals[condition.metric] = val

            if passes:
                candidates.append((symbol, metric_vals))

        # Soft fallback if filters were too restrictive or data was missing
        if not candidates and self.prices:
            top_n_target = self.rules.selection.top_n if self.rules.selection else 20
            sorted_symbols = sorted(
                self.prices.keys(),
                key=lambda s: self.stock_map.get(s, {}).get("market_cap") or 0,
                reverse=True
            )
            for sym in sorted_symbols[:top_n_target]:
                candidates.append((sym, {}))

        # Rank if configured
        if self.rules.ranking and candidates:
            # Handle weighted composite ranking
            if getattr(self.rules.ranking, "weights", None):
                weights = self.rules.ranking.weights
                
                # Precompute min/max for min-max scaling per metric across the universe on this date
                metrics_stats = {}
                for w in weights:
                    metric = w.metric if hasattr(w, "metric") else w["metric"]
                    vals = []
                    for c in candidates:
                        # Fetch metric if not already fetched by filters
                        if metric not in c[1]:
                            val = self._get_metric_at_date(c[0], metric, as_of)
                            c[1][metric] = val
                        if c[1][metric] is not None:
                            vals.append(c[1][metric])
                    
                    if vals:
                        metrics_stats[metric] = {"min": min(vals), "max": max(vals)}
                        
                # Score candidates
                scored_candidates = []
                missing_policy = getattr(self.rules.ranking, "missing_data_policy", "exclude") if self.rules.ranking else "exclude"
                
                for c in candidates:
                    sym, metric_vals = c
                    score = 0.0
                    total_weight = 0.0
                    skip_candidate = False
                    
                    for w in weights:
                        metric = w.metric if hasattr(w, "metric") else w["metric"]
                        weight_val = w.weight if hasattr(w, "weight") else w["weight"]
                        
                        val = metric_vals.get(metric)
                        stats = metrics_stats.get(metric)
                        
                        if val is not None and stats and stats["max"] > stats["min"]:
                            norm_val = (val - stats["min"]) / (stats["max"] - stats["min"])
                            if metric in LOWER_IS_BETTER_METRICS:
                                norm_val = 1.0 - norm_val
                            score += norm_val * weight_val
                        else:
                            if missing_policy == "exclude":
                                skip_candidate = True
                                break
                            elif missing_policy == "penalize":
                                # 0 score for missing data
                                score += 0.0 * weight_val
                            else:
                                # Neutral Imputation for missing data
                                score += 0.5 * weight_val
                            
                        total_weight += weight_val
                    
                    if not skip_candidate:
                        composite_score = (score / total_weight) * 100 if total_weight > 0 else 0.0
                        scored_candidates.append((sym, composite_score))
                    
                scored_candidates.sort(key=lambda x: x[1], reverse=True)
                candidates = scored_candidates
                
            # Fallback to single metric ranking for legacy strategies
            else:
                rank_metric = self.rules.ranking.metric
                reverse = self.rules.ranking.order == "desc"
                candidates.sort(
                    key=lambda x: x[1].get(rank_metric, 0) or 0,
                    reverse=reverse,
                )

        # Select top N with Sector Limit
        top_n = self.rules.selection.top_n if self.rules.selection else 30
        max_per_sector = max(1, int(top_n * 0.4))
        
        selected = []
        sector_counts = {}
        for c in candidates:
            if len(selected) >= top_n:
                break
            sym = c[0]
            sector = self.stock_map.get(sym, {}).get("sector")
            if sector:
                if sector_counts.get(sector, 0) >= max_per_sector:
                    continue
                sector_counts[sector] = sector_counts.get(sector, 0) + 1
            selected.append(sym)

        # Position Sizing
        position_sizing = getattr(self.rules, "position_sizing", "equal")
        weights = {}
        if position_sizing == "inverse_volatility":
            inv_vols = {}
            for sym in selected:
                vol = self._get_metric_at_date(sym, "volatility_90d", as_of)
                if not vol:
                    vol = self._get_metric_at_date(sym, "volatility_30d", as_of)
                if not vol or vol <= 0:
                    vol = 0.30
                inv_vols[sym] = 1.0 / vol
            total_inv_vol = sum(inv_vols.values())
            for sym, iv in inv_vols.items():
                weights[sym] = iv / total_inv_vol if total_inv_vol > 0 else 1.0 / len(selected)
        elif position_sizing == "risk_parity":
            try:
                from scipy.optimize import minimize
                
                returns_data = {}
                for sym in selected:
                    df = self.prices.get(sym)
                    if df is not None:
                        avail = df.loc[:as_of]
                        if not avail.empty:
                            prices = avail["close"].iloc[-253:]
                            returns_data[sym] = prices.pct_change().dropna()
                
                if returns_data:
                    ret_df = pd.DataFrame(returns_data).dropna()
                else:
                    ret_df = pd.DataFrame()

                if not ret_df.empty and len(ret_df.columns) == len(selected) and len(ret_df) > 30:
                    cov_matrix = ret_df.cov().values * 252
                    n = len(selected)
                    initial_weights = np.ones(n) / n
                    
                    def risk_budget_objective(w, cov):
                        port_var = w.T @ cov @ w
                        if port_var == 0: return 1e9
                        port_vol = np.sqrt(port_var)
                        mrc = (cov @ w) / port_vol
                        rc = w * mrc
                        target_rc = port_vol / n
                        return np.sum(np.square(rc - target_rc)) * 1000
                    
                    bounds = tuple((0.0, 1.0) for _ in range(n))
                    constraints = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0})
                    
                    res = minimize(
                        risk_budget_objective,
                        initial_weights,
                        args=(cov_matrix,),
                        method='SLSQP',
                        bounds=bounds,
                        constraints=constraints,
                        options={'ftol': 1e-6, 'disp': False}
                    )
                    
                    if res.success:
                        opt_weights = res.x
                        for i, sym in enumerate(selected):
                            weights[sym] = float(opt_weights[i])
                    else:
                        logger.warning(f"[{as_of.date()}] Risk Parity optimization failed: {res.message}")
                        for sym in selected:
                            weights[sym] = 1.0 / len(selected)
                else:
                    for sym in selected:
                        weights[sym] = 1.0 / len(selected)
            except Exception as e:
                logger.error(f"[{as_of.date()}] Error in risk parity: {str(e)}")
                for sym in selected:
                    weights[sym] = 1.0 / len(selected)
        else:
            for sym in selected:
                weights[sym] = 1.0 / len(selected) if selected else 0

        logger.debug(
            f"[{as_of.date()}] Selection: {len(candidates)} passed filters, "
            f"{skipped_no_data} no data, {skipped_none_metric} null metric, "
            f"selected {len(selected)}"
        )

        return weights

    def _get_close_price(self, symbol: str, dt: pd.Timestamp) -> Optional[float]:
        """Get the closing price for a stock at or just before a date."""
        df = self.prices.get(symbol)
        if df is None:
            return None
        available = df.loc[:dt]
        if available.empty:
            return None
        return float(available["close"].iloc[-1])

    def _get_open_price(self, symbol: str, dt: pd.Timestamp) -> Optional[float]:
        """Get the opening price for execution on T+1."""
        df = self.prices.get(symbol)
        if df is None:
            return None
        available = df.loc[:dt]
        if available.empty:
            return None
        return float(available["open"].iloc[-1])

    def _get_adv(self, symbol: str, dt: pd.Timestamp, window: int = 20) -> Optional[float]:
        """Get the average daily volume in rupees."""
        df = self.prices.get(symbol)
        if df is None: return None
        available = df.loc[:dt]
        if available.empty: return None
        last_n = available.iloc[-window:]
        if last_n.empty: return None
        adv = (last_n["volume"] * last_n["close"]).mean()
        return float(adv)

    def run(self) -> dict:
        """Execute the backtest simulation. Returns raw result dict."""
        if self.trading_dates.empty:
            return self._empty_result()

        # Clip to actual available data range
        start_idx = self.trading_dates.searchsorted(pd.Timestamp(self.start_date))
        end_idx = self.trading_dates.searchsorted(pd.Timestamp(self.end_date), side="right")
        sim_dates = self.trading_dates[start_idx:end_idx]

        if len(sim_dates) < 2:
            return self._empty_result()

        # Generate rebalance dates
        rebalance_indices = list(range(0, len(sim_dates), self.rebalance_freq))
        if 0 not in rebalance_indices:
            rebalance_indices.insert(0, 0)
        rebalance_dates = set(sim_dates[i] for i in rebalance_indices if i < len(sim_dates))

        # State
        cash = self.initial_capital
        positions: dict[str, list[dict]] = {}  # symbol -> list of FIFO lots
        equity_curve = []
        trades = []
        total_taxes_paid = 0.0

        # Buy & Hold Baseline State
        bh_cash = self.initial_capital
        bh_positions = {}
        bh_equity_curve = []

        for day_idx, current_date in enumerate(sim_dates):
            # 1. Daily Stop-Loss and Take-Profit checks
            sl_pct = getattr(self.rules, "stop_loss_pct", None)
            tp_pct = getattr(self.rules, "take_profit_pct", None)
            
            if sl_pct or tp_pct:
                to_sell = []
                for sym, lots in list(positions.items()):
                    if not lots: continue
                    total_shares = sum(l["shares"] for l in lots)
                    avg_cost = sum(l["shares"] * l["price"] for l in lots) / total_shares if total_shares > 0 else 0
                    
                    price = self._get_close_price(sym, current_date)
                    if not price or avg_cost == 0: continue
                    
                    pnl_pct = (price - avg_cost) / avg_cost
                    if sl_pct and pnl_pct <= -sl_pct:
                        exec_price = self._get_open_price(sym, sim_dates[day_idx + 1]) if day_idx + 1 < len(sim_dates) else price
                        if exec_price:
                            to_sell.append((sym, "Stop Loss Hit (Sold to cut losses)", exec_price, total_shares, avg_cost, pnl_pct))
                    elif tp_pct and pnl_pct >= tp_pct:
                        exec_price = self._get_open_price(sym, sim_dates[day_idx + 1]) if day_idx + 1 < len(sim_dates) else price
                        if exec_price:
                            to_sell.append((sym, "Take Profit Hit (Sold to lock in gains)", exec_price, total_shares, avg_cost, pnl_pct))
                        
                for sym, reason, price, shares, avg_cost, pnl_pct in to_sell:
                    lots = positions[sym]
                    exec_date = sim_dates[day_idx + 1] if day_idx + 1 < len(sim_dates) else current_date
                    new_lots, realized_pnl, tax_paid = self._sell_fifo_lots(lots, shares, price, exec_date)
                    
                    sell_value = shares * price
                    # STT and slippage
                    cost = sell_value * (self.tx_cost_pct + self.slippage_pct + 0.001) # adding 0.1% STT explicitly
                    cash += sell_value - cost - tax_paid
                    total_taxes_paid += tax_paid
                    
                    trades.append({
                        "date": current_date.strftime("%Y-%m-%d"),
                        "action": "SELL",
                        "symbol": sym,
                        "name": self.stock_map.get(sym, {}).get("name", sym),
                        "shares": shares,
                        "price": round(price, 2),
                        "value": round(sell_value, 2),
                        "reason": reason,
                        "pnl_pct": round(pnl_pct, 6),
                        "tax_paid": round(tax_paid, 2)
                    })
                    
                    del positions[sym]

            # 2. Check if rebalance day
            if current_date in rebalance_dates:
                target_weights = self._select_stocks_at_date(current_date)
                
                # T+1 Execution Date
                if day_idx + 1 < len(sim_dates):
                    execution_date = sim_dates[day_idx + 1]
                else:
                    execution_date = current_date
                
                # If day 1, initialize Buy & Hold baseline
                if day_idx == 0:
                    total_valid_weight = sum(target_weights.values())
                    for sym, weight in target_weights.items():
                        price = self._get_open_price(sym, execution_date)
                        if price and total_valid_weight > 0:
                            adj_weight = weight / total_valid_weight
                            target_value = self.initial_capital * adj_weight
                            buy_shares = int(target_value / (price * (1 + self.tx_cost_pct + self.slippage_pct + 0.001)))
                            if buy_shares > 0:
                                buy_cost = buy_shares * price * (1 + self.tx_cost_pct + self.slippage_pct + 0.001)
                                bh_cash -= buy_cost
                                bh_positions[sym] = buy_shares

                max_adv = getattr(self.rules, "max_adv_pct", 0.10)
                cash, positions, tax_paid_reb, day_trades = self._rebalance(
                    execution_date, cash, positions, target_weights, max_adv
                )
                total_taxes_paid += tax_paid_reb
                trades.extend(day_trades)

            # Calculate Buy & Hold baseline value first for hedge PnL calculation
            bh_val = bh_cash
            for sym, shares in bh_positions.items():
                price = self._get_close_price(sym, current_date)
                if price is not None:
                    bh_val += shares * price
            
            # Apply hedge PnL if strategy is long_short or market_neutral
            hedge_ratio = getattr(self.rules, "hedge_ratio", 0.0)
            strategy_type = getattr(self.rules, "strategy_type", "long_only")
            if strategy_type in ["long_short", "market_neutral"] and hedge_ratio > 0 and len(bh_equity_curve) > 0 and len(equity_curve) > 0:
                prev_bh_val = bh_equity_curve[-1]["value"]
                prev_port_val = equity_curve[-1]["value"]
                if prev_bh_val > 0:
                    bench_ret = (bh_val - prev_bh_val) / prev_bh_val
                    # Shorting index: if index drops (ret < 0), we make money.
                    hedge_pnl = prev_port_val * hedge_ratio * (-bench_ret)
                    cash += hedge_pnl

            bh_equity_curve.append({
                "date": current_date,
                "value": bh_val,
            })

            # Calculate daily portfolio value
            portfolio_val = cash
            for sym, lots in positions.items():
                shares = sum(l["shares"] for l in lots)
                price = self._get_close_price(sym, current_date)
                if price is not None:
                    portfolio_val += shares * price

            equity_curve.append({
                "date": current_date,
                "value": portfolio_val,
            })

        # Build equity series
        eq_series = pd.Series(
            [e["value"] for e in equity_curve],
            index=pd.DatetimeIndex([e["date"] for e in equity_curve]),
        )
        
        benchmark_series = pd.Series(
            [e["value"] for e in bh_equity_curve],
            index=pd.DatetimeIndex([e["date"] for e in bh_equity_curve]),
        )

        # Compute metrics
        metrics = compute_metrics(eq_series, benchmark_series)
        monthly = compute_monthly_returns(eq_series)
        trade_stats = compute_trade_stats(trades)
        metrics.update(trade_stats)

        # Build equity curve with benchmark and drawdown
        eq_curve_out = []
        cummax = eq_series.cummax()
        drawdown = (eq_series - cummax) / cummax

        for i, (dt, val) in enumerate(eq_series.items()):
            bench_val = None
            if benchmark_series is not None and dt in benchmark_series.index:
                # Normalize benchmark to same starting capital
                bench_val = float(
                    benchmark_series.loc[dt] / benchmark_series.iloc[0] * self.initial_capital
                )
            eq_curve_out.append({
                "date": dt.strftime("%Y-%m-%d"),
                "portfolio_value": round(val, 2),
                "benchmark_value": round(bench_val, 2) if bench_val else None,
                "drawdown": round(float(drawdown.iloc[i]), 6),
            })

        # End-of-period holdings
        holdings = []
        final_date = sim_dates[-1]
        for sym, lots in positions.items():
            price = self._get_close_price(sym, final_date)
            shares = sum(l["shares"] for l in lots)
            if price and shares > 0:
                avg_cost = sum(l["shares"] * l["price"] for l in lots) / shares
                pnl_pct = (price - avg_cost) / avg_cost if avg_cost > 0 else 0
                total_val = shares * price
                portfolio_total = eq_series.iloc[-1]
                holdings.append({
                    "symbol": sym,
                    "name": self.stock_map.get(sym, {}).get("name", sym),
                    "shares": shares,
                    "weight": round(total_val / portfolio_total, 4) if portfolio_total > 0 else 0,
                    "avg_cost": round(avg_cost, 2),
                    "current_price": round(price, 2),
                    "pnl_pct": round(pnl_pct, 6),
                })

        return {
            "initial_capital": self.initial_capital,
            "total_taxes_paid": round(total_taxes_paid, 2),
            "final_value": round(eq_series.iloc[-1], 2),
            "metrics": metrics,
            "equity_curve": eq_curve_out,
            "trades": trades,
            "monthly_returns": monthly,
            "holdings": holdings,
        }

    
    def _sell_fifo_lots(
        self,
        lots: list[dict],
        sell_shares: int,
        sell_price: float,
        current_date: pd.Timestamp
    ) -> tuple[list[dict], float, float]:
        """Sell shares using FIFO accounting. Returns: (new_lots, realized_pnl, tax_paid)"""
        stcg_tax = 0.0
        ltcg_tax = 0.0
        realized_pnl = 0.0
        remaining_to_sell = sell_shares
        new_lots = []
        
        for lot in lots:
            if remaining_to_sell <= 0:
                new_lots.append(lot)
                continue
                
            sell_from_lot = min(lot['shares'], remaining_to_sell)
            lot_pnl = (sell_price - lot['price']) * sell_from_lot
            realized_pnl += lot_pnl
            
            days_held = (current_date - lot['date']).days
            if lot_pnl > 0:
                if days_held >= 365:
                    ltcg_tax += lot_pnl * 0.125
                else:
                    stcg_tax += lot_pnl * 0.20
                    
            remaining_to_sell -= sell_from_lot
            if lot['shares'] > sell_from_lot:
                new_lots.append({
                    "date": lot['date'],
                    "shares": lot['shares'] - sell_from_lot,
                    "price": lot['price']
                })
                
        return new_lots, realized_pnl, stcg_tax + ltcg_tax

    def _rebalance(
        self,
        execution_date: pd.Timestamp,
        cash: float,
        positions: dict[str, list[dict]],
        target_weights: dict[str, float],
        max_adv_pct: float = 0.10,
    ) -> tuple[float, dict[str, list[dict]], float, list[dict]]:
        """Rebalance portfolio to target allocations at T+1 open."""
        trades = []
        total_taxes_paid = 0.0

        # Calculate current portfolio value based on execution price
        portfolio_val = cash
        current_prices = {}
        for sym, lots in positions.items():
            price = self._get_open_price(sym, execution_date)
            if price:
                current_prices[sym] = price
                portfolio_val += sum(l["shares"] for l in lots) * price

        # Get prices for target symbols
        for sym in target_weights.keys():
            if sym not in current_prices:
                price = self._get_open_price(sym, execution_date)
                if price:
                    current_prices[sym] = price

        valid_targets = [s for s in target_weights.keys() if s in current_prices]
        if not valid_targets and not positions:
            return cash, positions, 0.0, trades

        new_positions = dict(positions)
        
        # 1. Sell positions entirely that are not in valid_targets
        for sym in list(new_positions.keys()):
            if sym not in valid_targets:
                price = current_prices.get(sym)
                if price:
                    lots = new_positions[sym]
                    sell_shares = sum(l["shares"] for l in lots)
                    if sell_shares > 0:
                        avg_cost = sum(l["shares"] * l["price"] for l in lots) / sell_shares
                        new_lots, realized_pnl, tax_paid = self._sell_fifo_lots(lots, sell_shares, price, execution_date)
                        
                        sell_value = sell_shares * price
                        cost = sell_value * (self.tx_cost_pct + self.slippage_pct + 0.001)
                        cash += sell_value - cost - tax_paid
                        total_taxes_paid += tax_paid
                        
                        trades.append({
                            "date": execution_date.strftime("%Y-%m-%d"),
                            "action": "SELL",
                            "symbol": sym,
                            "name": self.stock_map.get(sym, {}).get("name", sym),
                            "shares": sell_shares,
                            "price": round(price, 2),
                            "value": round(sell_value, 2),
                            "reason": "Dropped from Strategy (Stock no longer meets criteria)",
                            "pnl_pct": round((price - avg_cost) / avg_cost, 6) if avg_cost > 0 else 0,
                            "tax_paid": round(tax_paid, 2)
                        })
                        del new_positions[sym]

        # 2. Rebalance existing and buy new
        total_valid_weight = sum(target_weights[sym] for sym in valid_targets)
        
        hedge_ratio = getattr(self.rules, "hedge_ratio", 0.0)
        strategy_type = getattr(self.rules, "strategy_type", "long_only")
        
        # Calculate available portfolio value for longs (deducting margin for shorts)
        # Assuming 20% margin requirement for index shorting
        long_portfolio_val = portfolio_val
        if strategy_type in ["long_short", "market_neutral"] and hedge_ratio > 0:
            margin_req = portfolio_val * hedge_ratio * 0.20
            long_portfolio_val = max(0, portfolio_val - margin_req)

        for sym in valid_targets:
            price = current_prices[sym]
            lots = new_positions.get(sym, [])
            current_shares = sum(l["shares"] for l in lots)
            current_value = current_shares * price
            
            adj_target_weight = target_weights[sym] / total_valid_weight if total_valid_weight > 0 else 0
            target_value_per_stock = long_portfolio_val * adj_target_weight
            
            # Apply Liquidity Constraints (ADV capping)
            adv = self._get_adv(sym, execution_date)
            if adv and max_adv_pct > 0:
                max_alloc = adv * max_adv_pct
                if target_value_per_stock > max_alloc:
                    target_value_per_stock = max_alloc

            diff_value = target_value_per_stock - current_value

            if abs(diff_value) < price:
                continue

            if diff_value > 0:
                # Buy
                buy_shares = int(diff_value / (price * (1 + self.tx_cost_pct + self.slippage_pct + 0.001)))
                if buy_shares <= 0: continue
                
                buy_cost = buy_shares * price * (1 + self.tx_cost_pct + self.slippage_pct + 0.001)
                if buy_cost > cash:
                    buy_shares = int(cash / (price * (1 + self.tx_cost_pct + self.slippage_pct + 0.001)))
                    if buy_shares <= 0: continue
                    buy_cost = buy_shares * price * (1 + self.tx_cost_pct + self.slippage_pct + 0.001)

                cash -= buy_cost
                new_lots = list(lots)
                new_lots.append({
                    "date": execution_date,
                    "shares": buy_shares,
                    "price": price
                })
                new_positions[sym] = new_lots

                trades.append({
                    "date": execution_date.strftime("%Y-%m-%d"),
                    "action": "BUY",
                    "symbol": sym,
                    "name": self.stock_map.get(sym, {}).get("name", sym),
                    "shares": buy_shares,
                    "price": round(price, 2),
                    "value": round(buy_shares * price, 2),
                    "reason": "New Entry (Stock met strategy criteria)" if current_shares == 0 else "Rebalance (Bought more to match target allocation)",
                })

            elif diff_value < -price:
                # Sell excess
                sell_shares = int(abs(diff_value) / price)
                if sell_shares <= 0: continue
                if sell_shares > current_shares: sell_shares = current_shares
                
                avg_cost = sum(l["shares"] * l["price"] for l in lots) / current_shares
                new_lots, realized_pnl, tax_paid = self._sell_fifo_lots(lots, sell_shares, price, execution_date)
                
                sell_value = sell_shares * price
                cost = sell_value * (self.tx_cost_pct + self.slippage_pct + 0.001)
                cash += sell_value - cost - tax_paid
                total_taxes_paid += tax_paid
                new_positions[sym] = new_lots

                trades.append({
                    "date": execution_date.strftime("%Y-%m-%d"),
                    "action": "SELL",
                    "symbol": sym,
                    "name": self.stock_map.get(sym, {}).get("name", sym),
                    "shares": sell_shares,
                    "price": round(price, 2),
                    "value": round(sell_value, 2),
                    "reason": "Rebalance (Sold some to match target allocation)",
                    "pnl_pct": round((price - avg_cost) / avg_cost, 6) if avg_cost > 0 else 0,
                    "tax_paid": round(tax_paid, 2)
                })

        return cash, new_positions, total_taxes_paid, trades

    def _build_benchmark_series(self, sim_dates: pd.DatetimeIndex) -> Optional[pd.Series]:
        """Build benchmark price series (e.g., Nifty 50)."""
        # Look for ^NSEI in our loaded prices
        bench_df = self.prices.get("^NSEI")
        if bench_df is None:
            return None
        # Reindex to sim_dates, forward fill
        bench_close = bench_df["close"].reindex(sim_dates, method="ffill")
        return bench_close.dropna()

    def _empty_result(self) -> dict:
        return {
            "initial_capital": self.initial_capital,
            "total_taxes_paid": 0.0,
            "final_value": self.initial_capital,
            "metrics": {},
            "equity_curve": [],
            "trades": [],
            "monthly_returns": [],
            "holdings": [],
        }


def _clean_floats(obj):
    if isinstance(obj, float):
        import math
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: _clean_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_floats(v) for v in obj]
    return obj


def _parse_date_string(d_str: str) -> date:
    """Parse date strings safely across formats (ISO YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, etc.)."""
    if not d_str:
        return date(2020, 1, 1)
    d_str = str(d_str).strip()
    if "T" in d_str:
        d_str = d_str.split("T")[0]

    try:
        return date.fromisoformat(d_str)
    except ValueError:
        pass

    for fmt in ("%d-%m-%Y", "%m-%d-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(d_str, fmt).date()
        except ValueError:
            pass

    logger.warning(f"Could not parse date string '{d_str}', defaulting to 2020-01-01")
    return date(2020, 1, 1)


async def run_backtest(request: BacktestRequest, db: AsyncSession) -> BacktestResponse:
    """Main entry point: run a portfolio backtest for a strategy."""
    # Load strategy
    result = await db.execute(select(Strategy).where(Strategy.id == request.strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise ValueError(f"Strategy {request.strategy_id} not found")

    if isinstance(strategy.rules_json, (dict, list)):
        rules = StrategyRules.model_validate(strategy.rules_json)
    else:
        rules = StrategyRules.model_validate_json(strategy.rules_json)

    # Allow request override of stop loss and take profit
    if request.stop_loss_pct is not None:
        rules.stop_loss_pct = request.stop_loss_pct
    if request.take_profit_pct is not None:
        rules.take_profit_pct = request.take_profit_pct

    # Parse dates robustly
    start = _parse_date_string(request.start_date)
    end = _parse_date_string(request.end_date)

    # Create and run backtester
    backtester = PortfolioBacktester(
        rules=rules,
        start_date=start,
        end_date=end,
        initial_capital=request.initial_capital,
        tx_cost_bps=request.tx_cost_bps,
        slippage_bps=request.slippage_bps,
        rebalance_frequency=request.rebalance_frequency,
    )

    await backtester.load_data(db)
    
    import asyncio
    raw = await asyncio.to_thread(backtester.run)

    # Clean raw data to prevent database and JSON serialization errors (NaN/Inf)
    raw = _clean_floats(raw)

    # Save result to DB
    bt_result = BacktestResult(
        strategy_id=strategy.id,
        start_date=start,
        end_date=end,
        initial_capital=request.initial_capital,
        final_value=raw["final_value"],
        cagr=raw["metrics"].get("cagr"),
        total_return=raw["metrics"].get("total_return"),
        max_drawdown=raw["metrics"].get("max_drawdown"),
        sharpe_ratio=raw["metrics"].get("sharpe_ratio"),
        sortino_ratio=raw["metrics"].get("sortino_ratio"),
        calmar_ratio=raw["metrics"].get("calmar_ratio"),
        volatility=raw["metrics"].get("volatility"),
        win_rate=raw["metrics"].get("win_rate"),
        total_trades=raw["metrics"].get("total_trades", 0),
        benchmark_return=raw["metrics"].get("benchmark_cagr"),
        transaction_cost_bps=request.tx_cost_bps,
        slippage_bps=request.slippage_bps,
        equity_curve_json=raw["equity_curve"],
        monthly_returns_json=raw["monthly_returns"],
        trade_log_json=raw["trades"],
        holdings_json=raw["holdings"],
        parameters_json={
            "rebalance_frequency": request.rebalance_frequency,
            "benchmark": request.benchmark_symbol,
        },
    )
    db.add(bt_result)
    await db.commit()
    await db.refresh(bt_result)

    # Update strategy status
    strategy.status = "backtested"
    await db.commit()

    # Build response
    return BacktestResponse(
        id=bt_result.id,
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        start_date=request.start_date,
        end_date=request.end_date,
        initial_capital=request.initial_capital,
        final_value=raw["final_value"],
        metrics=BacktestMetrics(**raw["metrics"]),
        equity_curve=[EquityCurvePoint(**p) for p in raw["equity_curve"]],
        trades=[TradeRecord(**t) for t in raw["trades"]],
        monthly_returns=[MonthlyReturn(**m) for m in raw["monthly_returns"]],
        holdings=[HoldingSnapshot(**h) for h in raw["holdings"]],
        created_at=bt_result.run_date,
    )
