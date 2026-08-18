"""Pydantic models for strategy rules, screener, and scoring."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# --- Filter / Rule definitions ---
class CustomStock(BaseModel):
    symbol: str
    name: str
    weight: Optional[float] = None



class FilterCondition(BaseModel):
    metric: str  # metric name, e.g. "dividend_yield"
    op: str  # ">", "<", ">=", "<=", "==", "between"
    value: float | list[float]  # single value or [min, max] for "between"
    unit: Optional[str] = None  # e.g. "cr" for crores


class MetricWeight(BaseModel):
    metric: str
    weight: float

class RankingConfig(BaseModel):
    metric: Optional[str] = None
    order: str = "desc"  # "asc" or "desc"
    weights: Optional[list[MetricWeight]] = None
    missing_data_policy: str = "exclude" # "exclude", "penalize", or "neutral"


class SelectionConfig(BaseModel):
    top_n: int = 30


class RebalanceConfig(BaseModel):
    frequency: str = "quarterly"  # monthly, quarterly, semi_annual, annual
    trade_if_weight_change_pct: Optional[float] = 0.05


class RegimeAdjustments(BaseModel):
    bear_action: str = "reduce_beta"  # "reduce_beta", "shift_defensive", "hold", "increase_cash"
    bull_action: str = "hold"         # "increase_exposure", "shift_cyclical", "hold"
    rebalance_on_regime_change: bool = True


class StrategyRules(BaseModel):
    name: str
    universe: str = "nifty500"
    filters: list[FilterCondition]  # list of conditions (supports multiple per metric)
    stocks: Optional[list[CustomStock]] = None  # for custom manual portfolios
    ranking: Optional[RankingConfig] = None
    selection: Optional[SelectionConfig] = None
    rebalance: Optional[RebalanceConfig] = None
    position_sizing: str = "equal"  # "equal", "inverse_volatility", or "risk_parity"
    stop_loss_pct: Optional[float] = Field(None, description="Stop-loss percentage threshold (e.g. 0.08 for 8%)")
    take_profit_pct: Optional[float] = Field(None, description="Take-profit percentage threshold (e.g. 0.20 for 20%)")
    trailing_stop_atr_multiple: Optional[float] = Field(None, description="ATR multiple for trailing stop (e.g., 2.0 = 2x ATR)")
    max_stock_drawdown_pct: Optional[float] = Field(None, description="Max drawdown per stock before forced exit (e.g., 0.25 = 25%)")
    max_adv_pct: Optional[float] = Field(0.10, description="Max allocation as a percentage of 20-day Average Daily Volume (e.g., 0.10 for 10%)")
    regime_adjustments: Optional[RegimeAdjustments] = None
    strategy_type: str = "long_only" # "long_only", "long_short", "market_neutral"
    hedge_ratio: float = 0.0
    warnings: list[str] = []


# --- Screener output ---
class StockScore(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    composite_score: Optional[float] = None
    position_weight: Optional[float] = None
    metric_values: dict[str, Optional[float]] = {}


class ScoredUniverse(BaseModel):
    strategy_name: str
    total_universe: int
    filtered_count: int
    stocks: list[StockScore]


# --- Strategy CRUD ---
class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    user_prompt: Optional[str] = None
    rules_json: str  # JSON string of StrategyRules
    strategy_type: str = "rule_based"
    position_sizing: str = "equal"
    universe: str = "nifty500"


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules_json: Optional[str] = None
    strategy_type: Optional[str] = None
    position_sizing: Optional[str] = None
    universe: Optional[str] = None
    status: Optional[str] = None


class StrategyOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    user_prompt: Optional[str] = None
    rules_json: Any
    strategy_type: str = "rule_based"
    position_sizing: Optional[str] = "equal"
    universe: Optional[str] = "nifty500"
    status: Optional[str] = "draft"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Available metrics for the UI ---
class MetricInfo(BaseModel):
    name: str
    label: str
    category: str  # "fundamental", "technical", "valuation", "risk"
    description: str


# --- Macro & Market Context Models ---
class SectorMomentum(BaseModel):
    sector: str
    avg_momentum_12m: Optional[float] = None
    stock_count: int = 0


class MacroContext(BaseModel):
    regime: str  # "bull", "bear", "sideways", "unknown"
    regime_reason: Optional[str] = None
    vix: float
    vix_zone: str  # "low", "moderate", "high"
    market_breadth_pct: float  # % stocks above 200-day SMA
    top_sectors: list[SectorMomentum] = []
    bottom_sectors: list[SectorMomentum] = []
    aggregate_news_sentiment: float = 0.0
    macro_summary: str = ""
