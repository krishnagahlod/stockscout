"""Pydantic models for backtesting requests, responses, and metrics."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class BacktestRequest(BaseModel):
    strategy_id: int
    start_date: str = "2020-01-01"
    end_date: str = "2024-12-31"
    initial_capital: float = 1000000.0  # 10 lakh INR
    rebalance_frequency: str = "quarterly"  # monthly, quarterly, semi_annual, annual
    tx_cost_bps: float = 20.0  # transaction cost in basis points
    slippage_bps: float = 10.0
    benchmark_symbol: str = "^NSEI"  # Nifty 50
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None


class BacktestMetrics(BaseModel):
    cagr: Optional[float] = None
    total_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    sortino_ratio: Optional[float] = None
    calmar_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    max_drawdown_duration_days: Optional[int] = None
    volatility: Optional[float] = None
    win_rate: Optional[float] = None
    avg_gain: Optional[float] = None
    avg_loss: Optional[float] = None
    total_trades: int = 0
    # Benchmark comparison
    benchmark_cagr: Optional[float] = None
    benchmark_sharpe: Optional[float] = None
    benchmark_max_dd: Optional[float] = None
    alpha: Optional[float] = None


class EquityCurvePoint(BaseModel):
    date: str
    portfolio_value: float
    benchmark_value: Optional[float] = None
    drawdown: float = 0.0


class TradeRecord(BaseModel):
    date: str
    action: str  # "BUY" or "SELL"
    symbol: str
    name: str
    shares: int
    price: float
    value: float
    reason: str = ""  # "rebalance", "new_entry", "exit", "stop_loss", "take_profit"
    pnl_pct: Optional[float] = None
    tax_paid: Optional[float] = None


class MonthlyReturn(BaseModel):
    year: int
    month: int
    return_pct: float


class HoldingSnapshot(BaseModel):
    symbol: str
    name: str
    shares: int
    weight: float
    avg_cost: float
    current_price: float
    pnl_pct: float


class BacktestResponse(BaseModel):
    id: int
    strategy_id: int
    strategy_name: str
    start_date: str
    end_date: str
    initial_capital: float
    final_value: float
    total_taxes_paid: Optional[float] = 0.0
    metrics: BacktestMetrics
    equity_curve: list[EquityCurvePoint]
    trades: list[TradeRecord]
    monthly_returns: list[MonthlyReturn]
    holdings: list[HoldingSnapshot]
    created_at: Optional[datetime] = None
