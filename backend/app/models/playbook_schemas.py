"""Pydantic schemas for the Strategy Playbook generation and UI representation."""

from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.strategy_schemas import StrategyRules, MacroContext

class ProfitTarget(BaseModel):
    level: str
    price: float
    gain_pct: float
    exit_pct: float
    method: str
    rationale: str

class TaxImpact(BaseModel):
    holding_period: str
    tax_rate_pct: float
    gross_gain_pct: float
    tax_pct: float
    net_gain_pct: float
    net_target_price: float


class StockPlaybookGuidance(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    current_price: float = 0.0
    entry_zone_low: float = 0.0
    entry_zone_high: float = 0.0
    initial_stop_loss: float = 0.0
    stop_distance_pct: float = 0.0
    take_profit_target: float = 0.0
    trailing_stop_rule: str = ""
    technical_signal_status: str = "NEUTRAL"  # e.g., "BULLISH_ENTRY", "HOLD_TREND", "WAIT_PULLBACK"
    entry_rationale: str = ""
    stop_loss_rationale: str = ""
    key_metrics_to_watch: list[str] = []
    news_catalysts: str = "No critical breaking news catalysts identified."
    regime_behavior: str = "Displays standard beta correlation with broader indices."
    profit_targets: list[ProfitTarget] = []
    tax_impact_short_term: list[TaxImpact] = []
    tax_impact_long_term: list[TaxImpact] = []
    risk_reward_ratio: float = 0.0
    breakeven_after_tax_pct: float = 0.0
    target_reasoning_summary: str = ""
    stop_loss_methodology: str = ""



class WatchlistCandidate(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    current_price: float = 0.0
    reason_near_miss: str = ""


class StrategyPlaybook(BaseModel):
    strategy_id: Optional[int] = None
    strategy_name: str
    generated_at: str
    macro_context: Optional[MacroContext] = None
    market_outlook: str = ""
    rebalance_schedule_guidance: str = ""
    overall_risk_budget: str = ""
    sector_allocation_rationale: str = ""
    stock_guidance: list[StockPlaybookGuidance] = []
    watchlist: list[WatchlistCandidate] = []


class PlaybookGenerateRequest(BaseModel):
    strategy_id: Optional[int] = None
    rules: Optional[StrategyRules] = None
