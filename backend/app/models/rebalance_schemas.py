from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class RebalanceTradeOrder(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    action: str  # BUY, SELL, HOLD, TRIM, ADD
    current_shares: int = 0
    target_shares: int = 0
    shares_difference: int = 0
    estimated_price: float = 0.0
    estimated_order_value: float = 0.0  # Rupee value of trade
    target_weight_pct: float = 0.0
    execution_guidance: str


class SectorAttribution(BaseModel):
    sector: str
    portfolio_weight_pct: float
    benchmark_weight_pct: float
    relative_weight_pct: float
    estimated_sector_return_pct: float
    contribution_to_alpha_pct: float
    commentary: str


class FactorAttribution(BaseModel):
    factor_name: str
    score_index: float  # 0.0 to 100.0 strength
    contribution_pct: float  # percentage of return explained
    status: str  # DOMINANT DRIVER, STABLE, DETRACTING
    description: str


class RebalanceExecutionPlan(BaseModel):
    strategy_id: int
    strategy_name: str
    generated_at: str
    portfolio_capital: float
    position_sizing_method: str
    estimated_turnover_pct: float
    estimated_tx_cost_inr: float
    orders: List[RebalanceTradeOrder] = []
    sector_attribution: List[SectorAttribution] = []
    factor_attribution: List[FactorAttribution] = []
    executive_summary: str
