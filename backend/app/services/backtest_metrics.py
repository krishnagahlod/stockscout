"""Compute portfolio performance metrics from an equity curve."""

import numpy as np
import pandas as pd
import statsmodels.api as sm

from app.core.config import settings


def compute_metrics(equity_series: pd.Series, benchmark_series: pd.Series | None = None) -> dict:
    """Compute all backtest metrics from a daily equity series.

    Args:
        equity_series: DatetimeIndex -> portfolio value (daily)
        benchmark_series: DatetimeIndex -> benchmark value (daily), optional

    Returns:
        dict of metric name -> value
    """
    if len(equity_series) < 2:
        return {}

    rf = settings.RISK_FREE_RATE
    daily_rf = rf / 252

    # Daily returns
    returns = equity_series.pct_change().dropna()
    excess = returns - daily_rf

    # Total return
    total_return = (equity_series.iloc[-1] / equity_series.iloc[0]) - 1

    # CAGR
    days = (equity_series.index[-1] - equity_series.index[0]).days
    years = days / 365.25
    cagr = (equity_series.iloc[-1] / equity_series.iloc[0]) ** (1 / years) - 1 if years > 0 else 0

    # Volatility (annualized)
    vol = returns.std() * np.sqrt(252) if len(returns) > 1 else 0

    # Sharpe ratio
    sharpe = (excess.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0

    # Sortino ratio (downside deviation)
    downside = returns[returns < daily_rf] - daily_rf
    downside_std = downside.std() * np.sqrt(252) if len(downside) > 1 else 0
    sortino = (cagr - rf) / downside_std if downside_std > 0 else 0

    # Drawdown series
    cummax = equity_series.cummax()
    drawdown = (equity_series - cummax) / cummax
    max_dd = drawdown.min()

    # Max drawdown duration
    dd_duration = _max_drawdown_duration(drawdown)

    # Calmar ratio
    calmar = cagr / abs(max_dd) if max_dd != 0 else 0

    metrics = {
        "cagr": round(cagr, 6),
        "total_return": round(total_return, 6),
        "sharpe_ratio": round(sharpe, 4),
        "sortino_ratio": round(sortino, 4),
        "calmar_ratio": round(calmar, 4),
        "max_drawdown": round(max_dd, 6),
        "max_drawdown_duration_days": dd_duration,
        "volatility": round(vol, 6),
    }

    # Benchmark metrics
    if benchmark_series is not None and len(benchmark_series) >= 2:
        bench_returns = benchmark_series.pct_change().dropna()
        bench_days = (benchmark_series.index[-1] - benchmark_series.index[0]).days
        bench_years = bench_days / 365.25
        bench_cagr = (benchmark_series.iloc[-1] / benchmark_series.iloc[0]) ** (1 / bench_years) - 1 if bench_years > 0 else 0
        bench_vol = bench_returns.std() * np.sqrt(252) if len(bench_returns) > 1 else 0
        bench_sharpe = ((bench_returns - daily_rf).mean() / bench_returns.std() * np.sqrt(252)) if bench_returns.std() > 0 else 0
        bench_cummax = benchmark_series.cummax()
        bench_dd = ((benchmark_series - bench_cummax) / bench_cummax).min()

        metrics["benchmark_cagr"] = round(bench_cagr, 6)
        metrics["benchmark_sharpe"] = round(bench_sharpe, 4)
        metrics["benchmark_max_dd"] = round(bench_dd, 6)
        metrics["alpha"] = round(cagr - bench_cagr, 6)

        # --- Barra-Lite Factor Attribution (Synthetic) ---
        # Generate synthetic factor returns for demonstration
        # In a real system, these would be fetched from a factor database (e.g., Fama-French)
        np.random.seed(42)  # For reproducible synthetic factors
        mkt_rf = bench_returns - daily_rf
        smb = np.random.normal(0.0001, 0.005, len(returns))  # Small Minus Big (Size)
        hml = np.random.normal(0.0002, 0.006, len(returns))  # High Minus Low (Value)
        mom = np.random.normal(0.0003, 0.007, len(returns))  # Momentum
        
        # Ensure alignment
        y = excess.values
        X = pd.DataFrame({
            'MKT': mkt_rf.values,
            'SMB': smb,
            'HML': hml,
            'MOM': mom
        })
        X = sm.add_constant(X)
        
        try:
            model = sm.OLS(y, X).fit()
            
            metrics["factor_alpha"] = round(model.params['const'] * 252, 6)  # Annualized alpha
            metrics["beta_market"] = round(model.params['MKT'], 4)
            metrics["beta_size"] = round(model.params['SMB'], 4)
            metrics["beta_value"] = round(model.params['HML'], 4)
            metrics["beta_momentum"] = round(model.params['MOM'], 4)
            metrics["r_squared"] = round(model.rsquared, 4)
        except Exception as e:
            # Fallback if regression fails
            metrics["factor_alpha"] = metrics["alpha"]
            metrics["beta_market"] = 1.0
            metrics["beta_size"] = 0.0
            metrics["beta_value"] = 0.0
            metrics["beta_momentum"] = 0.0
            metrics["r_squared"] = 0.0

    return metrics


def compute_monthly_returns(equity_series: pd.Series) -> list[dict]:
    """Compute month-by-month returns for the heatmap."""
    try:
        monthly = equity_series.resample("ME").last()
    except (ValueError, Exception):
        monthly = equity_series.resample("M").last()
    monthly_ret = monthly.pct_change().dropna()

    results = []
    for date_idx, ret in monthly_ret.items():
        results.append({
            "year": date_idx.year,
            "month": date_idx.month,
            "return_pct": round(ret, 6),
        })
    return results


def compute_trade_stats(trades: list[dict]) -> dict:
    """Compute win rate and avg gain/loss from trade records."""
    sells = [t for t in trades if t.get("action") == "SELL"]
    if not sells:
        return {"win_rate": None, "avg_gain": None, "avg_loss": None, "total_trades": 0}

    gains = []
    losses = []
    for t in sells:
        pnl = t.get("pnl_pct", 0)
        if pnl >= 0:
            gains.append(pnl)
        else:
            losses.append(pnl)

    win_rate = len(gains) / len(sells) if sells else 0
    avg_gain = np.mean(gains) if gains else 0
    avg_loss = np.mean(losses) if losses else 0

    return {
        "win_rate": round(win_rate, 4),
        "avg_gain": round(avg_gain, 6),
        "avg_loss": round(avg_loss, 6),
        "total_trades": len(sells),
    }


def _max_drawdown_duration(drawdown: pd.Series) -> int:
    """Calculate the maximum drawdown duration in calendar days."""
    if drawdown.empty:
        return 0

    in_dd = drawdown < 0
    max_dur = 0
    current_start = None

    for date_idx, is_dd in in_dd.items():
        if is_dd:
            if current_start is None:
                current_start = date_idx
        else:
            if current_start is not None:
                dur = (date_idx - current_start).days
                max_dur = max(max_dur, dur)
                current_start = None

    # Handle still in drawdown at end
    if current_start is not None:
        dur = (drawdown.index[-1] - current_start).days
        max_dur = max(max_dur, dur)

    return max_dur
