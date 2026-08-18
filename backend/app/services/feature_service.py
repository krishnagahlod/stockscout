"""Compute technical indicators from daily price data using the `ta` library."""

import math
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import ta
from loguru import logger
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, DailyPrice, TechnicalFeature


async def _load_prices(db: AsyncSession, stock_id: int) -> pd.DataFrame:
    """Load all daily prices for a stock into a DataFrame."""
    result = await db.execute(
        select(DailyPrice)
        .where(DailyPrice.stock_id == stock_id)
        .order_by(DailyPrice.date.asc())
    )
    rows = result.scalars().all()
    if not rows:
        return pd.DataFrame()

    data = [
        {
            "date": r.date,
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "adj_close": r.adj_close,
            "volume": r.volume,
        }
        for r in rows
    ]
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    return df


async def _load_benchmark_returns(db: AsyncSession) -> Optional[pd.Series]:
    """Load Nifty 50 (^NSEI) daily returns for beta calculation."""
    result = await db.execute(select(Stock).where(Stock.symbol == "^NSEI"))
    nifty = result.scalar_one_or_none()
    if not nifty:
        return None

    df = await _load_prices(db, nifty.id)
    if df.empty:
        return None
    return df["close"].pct_change()


def compute_technical_indicators(df: pd.DataFrame, benchmark_returns: Optional[pd.Series] = None) -> pd.DataFrame:
    """Compute all technical features for a stock price DataFrame.

    Returns a DataFrame indexed by date with one row per trading day.
    """
    features = pd.DataFrame(index=df.index)
    if df.empty or len(df) < 2:
        return features

    if len(df) < 200:
        logger.warning(f"Only {len(df)} rows — need 200+ for full indicators")

    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]
    returns = close.pct_change(fill_method=None)

    # Moving averages
    features["sma_50"] = ta.trend.SMAIndicator(close, window=50).sma_indicator() if len(df) >= 50 else np.nan
    features["sma_200"] = ta.trend.SMAIndicator(close, window=200).sma_indicator() if len(df) >= 200 else np.nan
    features["ema_50"] = ta.trend.EMAIndicator(close, window=50).ema_indicator() if len(df) >= 50 else np.nan
    features["ema_200"] = ta.trend.EMAIndicator(close, window=200).ema_indicator() if len(df) >= 200 else np.nan

    # RSI
    features["rsi_14"] = ta.momentum.RSIIndicator(close, window=14).rsi() if len(df) >= 14 else np.nan

    # MACD
    if len(df) >= 26:
        macd_ind = ta.trend.MACD(close)
        features["macd"] = macd_ind.macd()
        features["macd_signal"] = macd_ind.macd_signal()
        features["macd_histogram"] = macd_ind.macd_diff()
    else:
        features["macd"] = np.nan
        features["macd_signal"] = np.nan
        features["macd_histogram"] = np.nan

    # ATR
    if len(df) >= 14:
        features["atr_14"] = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()
    else:
        features["atr_14"] = np.nan

    # Bollinger Bands
    if len(df) >= 20:
        bb = ta.volatility.BollingerBands(close, window=20)
        features["bollinger_upper"] = bb.bollinger_hband()
        features["bollinger_lower"] = bb.bollinger_lband()
        features["bollinger_width"] = bb.bollinger_wband()
    else:
        features["bollinger_upper"] = np.nan
        features["bollinger_lower"] = np.nan
        features["bollinger_width"] = np.nan
    # Volatility (annualized)
    features["volatility_30d"] = returns.rolling(30, min_periods=5).std() * np.sqrt(252) if len(df) >= 5 else np.nan
    features["volatility_90d"] = returns.rolling(90, min_periods=5).std() * np.sqrt(252) if len(df) >= 5 else np.nan

    # Beta (vs benchmark)
    if benchmark_returns is not None:
        aligned = pd.DataFrame({"stock": returns, "bench": benchmark_returns}).dropna()
        if len(aligned) >= 252:
            rolling_cov = aligned["stock"].rolling(252).cov(aligned["bench"])
            rolling_var = aligned["bench"].rolling(252).var()
            beta = rolling_cov / rolling_var
            features["beta"] = beta.reindex(features.index)
        else:
            features["beta"] = np.nan
    else:
        features["beta"] = np.nan

    # Max drawdown (trailing 1 year / 252 days)
    rolling_max = close.rolling(252, min_periods=1).max()
    drawdown = (close - rolling_max) / rolling_max
    features["max_drawdown_1y"] = drawdown.rolling(252, min_periods=1).min()

    # Trailing Sharpe ratio (252d, rf=6%)
    daily_rf = 0.06 / 252
    excess = returns - daily_rf
    rolling_mean = excess.rolling(252).mean()
    rolling_std = returns.rolling(252).std()
    features["sharpe_trailing"] = (rolling_mean / rolling_std) * np.sqrt(252)

    # Momentum (12 month)
    features["momentum_12m"] = close.pct_change(252)

    # Volume averages
    features["avg_volume_20d"] = volume.rolling(20).mean()
    features["avg_turnover_3m"] = (close * volume).rolling(63).mean()

    return features


async def compute_and_store_features(db: AsyncSession, stock: Stock, benchmark_returns: Optional[pd.Series] = None) -> int:
    """Compute features for a stock and upsert into DB. Returns row count."""
    df = await _load_prices(db, stock.id)
    if df.empty:
        return 0

    features = compute_technical_indicators(df, benchmark_returns)

    # Only store the latest row (most recent date) to keep DB lean for now
    # For backtesting we'll compute on-the-fly
    latest = features.tail(1)
    if latest.empty:
        return 0

    count = 0
    for date_idx, row in latest.iterrows():
        feat_date = date_idx.date() if hasattr(date_idx, "date") else date_idx

        existing = await db.execute(
            select(TechnicalFeature).where(
                TechnicalFeature.stock_id == stock.id,
                TechnicalFeature.date == feat_date,
            )
        )
        feat = existing.scalar_one_or_none()

        vals = {}
        for col in [
            "sma_50", "sma_200", "ema_50", "ema_200", "rsi_14",
            "macd", "macd_signal", "macd_histogram", "atr_14",
            "bollinger_upper", "bollinger_lower", "bollinger_width",
            "volatility_30d", "volatility_90d",
            "max_drawdown_1y", "sharpe_trailing", "momentum_12m",
        ]:
            v = row.get(col)
            vals[col] = None if (v is None or (isinstance(v, float) and math.isnan(v))) else float(v)

        if feat:
            for k, v in vals.items():
                setattr(feat, k, v)
        else:
            feat = TechnicalFeature(stock_id=stock.id, date=feat_date, **vals)
            db.add(feat)
        count += 1

    await db.commit()
    return count


async def recompute_all_features(db: AsyncSession, limit: Optional[int] = None) -> int:
    """Recompute technical features for all stocks."""
    result = await db.execute(select(Stock))
    stocks = result.scalars().all()
    if limit:
        stocks = stocks[:limit]

    benchmark_returns = await _load_benchmark_returns(db)

    total = 0
    for i, stock in enumerate(stocks):
        logger.info(f"[{i+1}/{len(stocks)}] Computing features for {stock.symbol}")
        try:
            count = await compute_and_store_features(db, stock, benchmark_returns)
            total += count
        except Exception as e:
            logger.error(f"Failed to compute features for {stock.symbol}: {e}")
            await db.rollback()

    return total
