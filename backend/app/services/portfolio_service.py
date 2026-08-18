"""Portfolio optimization — equal weight, inverse volatility, and min variance.

Uses numpy directly since pyportfolioopt requires C++ build tools.
"""

import json
import math
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from loguru import logger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, DailyPrice, Strategy, BacktestResult, PortfolioAllocation


class PortfolioOptimizer:
    """Portfolio optimization with multiple methods."""

    async def load_returns(
        self, db: AsyncSession, symbols: list[str], lookback_days: int = 252
    ) -> pd.DataFrame:
        """Load daily returns for given symbols."""
        end = date.today()
        start = end - timedelta(days=lookback_days + 30)  # buffer for weekends

        frames = {}
        for symbol in symbols:
            result = await db.execute(
                select(Stock).where(Stock.symbol == symbol)
            )
            stock = result.scalar_one_or_none()
            if not stock:
                # Try with .NS suffix
                result = await db.execute(
                    select(Stock).where(Stock.symbol == f"{symbol}.NS")
                )
                stock = result.scalar_one_or_none()
            if not stock:
                continue

            price_result = await db.execute(
                select(DailyPrice)
                .where(and_(
                    DailyPrice.stock_id == stock.id,
                    DailyPrice.date >= start,
                ))
                .order_by(DailyPrice.date.asc())
            )
            rows = price_result.scalars().all()
            if rows:
                series = pd.Series(
                    {r.date: r.close for r in rows},
                    name=stock.symbol,
                )
                frames[stock.symbol] = series

        if not frames:
            return pd.DataFrame()

        prices = pd.DataFrame(frames)
        prices.index = pd.to_datetime(prices.index)
        prices = prices.sort_index().dropna(how="all")
        returns = prices.pct_change().dropna()
        return returns

    def equal_weight(self, tickers: list[str]) -> dict[str, float]:
        """Simple 1/N allocation."""
        n = len(tickers)
        if n == 0:
            return {}
        w = 1.0 / n
        return {t: round(w, 6) for t in tickers}

    def inverse_volatility(self, returns: pd.DataFrame) -> dict[str, float]:
        """Inverse-volatility weighting (simple risk parity proxy)."""
        vol = returns.std()
        vol = vol[vol > 0]
        if vol.empty:
            return self.equal_weight(list(returns.columns))

        inv_vol = 1.0 / vol
        weights = inv_vol / inv_vol.sum()
        return {col: round(float(w), 6) for col, w in weights.items()}

    def min_variance(self, returns: pd.DataFrame) -> dict[str, float]:
        """Minimum variance portfolio using closed-form solution.

        w* = (Σ^-1 * 1) / (1' * Σ^-1 * 1)
        """
        cov = returns.cov().values
        n = cov.shape[0]

        try:
            inv_cov = np.linalg.inv(cov)
        except np.linalg.LinAlgError:
            # Singular matrix — fall back to inverse volatility
            logger.warning("Covariance matrix is singular, falling back to inv-vol")
            return self.inverse_volatility(returns)

        ones = np.ones(n)
        w = inv_cov @ ones
        w = w / w.sum()

        # Clip negative weights (no shorting)
        w = np.maximum(w, 0)
        if w.sum() > 0:
            w = w / w.sum()

        return {col: round(float(w[i]), 6) for i, col in enumerate(returns.columns)}

    def max_sharpe(self, returns: pd.DataFrame, risk_free: float = 0.06) -> dict[str, float]:
        """Max Sharpe ratio portfolio using mean-variance optimization.

        Simple analytical solution for the tangency portfolio.
        """
        mu = returns.mean() * 252  # annualized
        cov = returns.cov() * 252  # annualized
        daily_rf = risk_free

        excess = mu - daily_rf

        try:
            inv_cov = np.linalg.inv(cov.values)
        except np.linalg.LinAlgError:
            return self.inverse_volatility(returns)

        w = inv_cov @ excess.values
        # Clip negative weights
        w = np.maximum(w, 0)
        if w.sum() > 0:
            w = w / w.sum()
        else:
            return self.equal_weight(list(returns.columns))

        return {col: round(float(w[i]), 6) for i, col in enumerate(returns.columns)}

    def discrete_allocation(
        self,
        weights: dict[str, float],
        prices: dict[str, float],
        total_capital: float,
    ) -> tuple[dict[str, int], float]:
        """Convert continuous weights to integer share counts.

        Returns (shares_dict, leftover_cash).
        """
        shares = {}
        invested = 0

        for symbol, weight in sorted(weights.items(), key=lambda x: -x[1]):
            price = prices.get(symbol, 0)
            if price <= 0:
                continue
            target_value = total_capital * weight
            n_shares = int(target_value / price)
            if n_shares > 0:
                shares[symbol] = n_shares
                invested += n_shares * price

        leftover = total_capital - invested
        return shares, round(leftover, 2)


async def optimize_portfolio(
    db: AsyncSession,
    strategy_id: int,
    method: str = "equal_weight",
    capital: float = 1_000_000,
) -> dict:
    """Optimize portfolio for a strategy and return allocation."""
    # Load strategy
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise ValueError(f"Strategy {strategy_id} not found")

    # Load latest backtest to get holdings
    bt_result = await db.execute(
        select(BacktestResult)
        .where(BacktestResult.strategy_id == strategy.id)
        .order_by(BacktestResult.run_date.desc())
        .limit(1)
    )
    backtest = bt_result.scalar_one_or_none()

    holdings = []
    if backtest and backtest.holdings_json:
        holdings = backtest.holdings_json if isinstance(backtest.holdings_json, (list, dict)) else json.loads(backtest.holdings_json)

    # If no backtest, try running the screener to get tickers
    if not holdings:
        from app.services.rule_engine import rule_engine
        from app.models.strategy_schemas import StrategyRules
        rules = StrategyRules.model_validate_json(strategy.rules_json)
        scored = await rule_engine.run(rules, db)
        tickers = [s.symbol for s in scored.stocks]
    else:
        tickers = [h["symbol"] for h in holdings]

    if not tickers:
        raise ValueError("No stocks to optimize. Run a screener or backtest first.")

    optimizer = PortfolioOptimizer()

    if method == "equal_weight":
        weights = optimizer.equal_weight(tickers)
    else:
        # Need returns data
        returns = await optimizer.load_returns(db, tickers)
        if returns.empty or len(returns.columns) < 2:
            logger.warning("Not enough return data, falling back to equal weight")
            weights = optimizer.equal_weight(tickers)
        elif method == "inverse_volatility":
            weights = optimizer.inverse_volatility(returns)
        elif method == "min_variance":
            weights = optimizer.min_variance(returns)
        elif method == "max_sharpe":
            weights = optimizer.max_sharpe(returns)
        else:
            weights = optimizer.equal_weight(tickers)

    # Get current prices for discrete allocation
    current_prices = {}
    for symbol in weights:
        result = await db.execute(
            select(Stock).where(Stock.symbol == symbol)
        )
        stock = result.scalar_one_or_none()
        if stock:
            price_result = await db.execute(
                select(DailyPrice)
                .where(DailyPrice.stock_id == stock.id)
                .order_by(DailyPrice.date.desc())
                .limit(1)
            )
            price = price_result.scalar_one_or_none()
            if price:
                current_prices[symbol] = price.close

    shares, leftover = optimizer.discrete_allocation(weights, current_prices, capital)

    # Build allocation details
    allocations = []
    for symbol, weight in sorted(weights.items(), key=lambda x: -x[1]):
        n_shares = shares.get(symbol, 0)
        price = current_prices.get(symbol, 0)
        value = n_shares * price
        stock_result = await db.execute(select(Stock).where(Stock.symbol == symbol))
        stock = stock_result.scalar_one_or_none()
        allocations.append({
            "symbol": symbol,
            "name": stock.name if stock else symbol,
            "weight": weight,
            "shares": n_shares,
            "price": round(price, 2),
            "value": round(value, 2),
        })

    # Save to DB
    alloc_record = PortfolioAllocation(
        strategy_id=strategy.id,
        backtest_id=backtest.id if backtest else None,
        allocation_method=method,
        capital=capital,
        allocations_json=json.dumps(allocations),
    )
    db.add(alloc_record)
    await db.commit()
    await db.refresh(alloc_record)

    return {
        "id": alloc_record.id,
        "strategy_id": strategy.id,
        "strategy_name": strategy.name,
        "method": method,
        "capital": capital,
        "invested": round(capital - leftover, 2),
        "leftover_cash": leftover,
        "allocations": allocations,
    }


# Singleton
portfolio_optimizer = PortfolioOptimizer()
