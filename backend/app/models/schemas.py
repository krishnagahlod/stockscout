from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


# --- Health ---
class HealthResponse(BaseModel):
    status: str
    db_connected: bool
    stock_count: int
    price_count: int
    last_sync: Optional[str] = None


# --- Stock ---
class StockOut(BaseModel):
    id: int
    symbol: str
    name: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap_cr: Optional[float] = None
    is_nifty500: bool = True

    class Config:
        from_attributes = True


class StockDetail(StockOut):
    ticker: Optional[str] = None
    exchange: Optional[str] = "NSE"
    is_index_member: Optional[bool] = True
    index_name: Optional[str] = "NIFTY 500"
    last_updated: Optional[datetime] = None
    created_at: Optional[datetime] = None
    fundamentals: Optional[dict] = None
    prices: Optional[list[dict]] = None
    news: Optional[list[dict]] = None
    financial_statements: Optional[dict] = None
    shareholding: Optional[list[dict]] = None
    peers: Optional[list[dict]] = None
    dvm_score: Optional[dict] = None


class PriceOut(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    adj_close: float
    volume: int
    dividends: float = 0
    stock_splits: float = 0

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


# --- Data Pipeline ---
class SyncStatus(BaseModel):
    total_stocks: int
    total_prices: int
    last_universe_sync: Optional[str] = None
    last_price_sync: Optional[str] = None


class SyncResult(BaseModel):
    success: bool
    message: str
    records_affected: int = 0
