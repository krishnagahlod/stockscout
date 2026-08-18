"""Pydantic models for LLM input/output."""

from typing import Optional
from pydantic import BaseModel


class ParseStrategyRequest(BaseModel):
    prompt: str  # plain-English description


class RiskFactor(BaseModel):
    factor: str
    severity: str = "medium"  # low, medium, high
    description: str


class InvestmentThesis(BaseModel):
    summary: str
    key_points: list[str]
    risks: list[RiskFactor]
    recommendation: str


class StockExplanation(BaseModel):
    symbol: str
    reasons: list[str]
    strengths: list[str]
    concerns: list[str]
    overall: str


class GenerateThesisRequest(BaseModel):
    strategy_id: Optional[int] = None
    rules_json: Optional[str] = None  # alternative: pass rules directly without saved strategy


class ExplainStockRequest(BaseModel):
    symbol: str
    strategy_id: Optional[int] = None


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    finalize: bool = False  # when True, extract strategy rules as JSON
    portfolio_context: Optional[str] = None


class ExplainRulesRequest(BaseModel):
    rules: dict  # StrategyRules as dict


class FilterExplanation(BaseModel):
    metric: str
    op: str
    value: float | list[float]
    explanation: str


class ExplainRulesResponse(BaseModel):
    strategy_summary: str
    filter_explanations: list[FilterExplanation]
    ranking_explanation: str
    suitability: str


class QuickPreviewStock(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None


class QuickPreviewResponse(BaseModel):
    match_count: int
    top_stocks: list[QuickPreviewStock]
    total_universe: int
