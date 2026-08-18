from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class HoldingDrift(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    status: str  # ALIGNED, AT_RISK, DRIFTED, STOP_LOSS_BREACHED, TAKE_PROFIT_REACHED
    current_price: float = 0.0
    stop_loss_price: Optional[float] = None
    take_profit_price: Optional[float] = None
    reasons: List[str] = []


class RegimeDriftWarning(BaseModel):
    current_regime: str
    severity: str  # low, medium, high
    recommended_action: str


class StrategyDriftReport(BaseModel):
    strategy_id: int
    strategy_name: str
    checked_at: str
    health_score: float  # 0.0 to 100.0
    health_status: str  # HEALTHY, NEEDS_REBALANCE, CRITICAL_INTERVENTION
    regime_warning: Optional[RegimeDriftWarning] = None
    holdings_drift: List[HoldingDrift] = []
    summary_commentary: str
    action_required: bool = False
