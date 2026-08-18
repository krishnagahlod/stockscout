from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, Float, Text, Boolean, Date, DateTime, ForeignKey, Index, UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column("ticker", Text, nullable=False, unique=True)  # e.g. "RELIANCE.NS"
    exchange = Column(Text, nullable=False, default="NSE")
    isin = Column(Text, nullable=True)
    name = Column(Text, nullable=False)
    sector = Column(Text)
    industry = Column(Text)
    market_cap_cr = Column(Float)  # in crores
    is_nifty500 = Column("is_index_member", Boolean, default=True)
    last_updated = Column("last_refreshed", DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    prices = relationship("DailyPrice", back_populates="stock")
    fundamentals = relationship("Fundamental", back_populates="stock")
    technical_features = relationship("TechnicalFeature", back_populates="stock")
    index_memberships = relationship("IndexConstituent", back_populates="stock")


class IndexConstituent(Base):
    __tablename__ = "index_constituents"
    __table_args__ = (
        UniqueConstraint("stock_id", "index_name", "added_date", name="uq_index_membership"),
        Index("idx_index_constituents_search", "index_name", "stock_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    index_name = Column(Text, nullable=False) # e.g. "nifty500"
    added_date = Column(Date, nullable=False)
    removed_date = Column(Date, nullable=True) # null if currently active

    stock = relationship("Stock", back_populates="index_memberships")


class DailyPrice(Base):
    __tablename__ = "daily_prices"
    __table_args__ = (
        UniqueConstraint("stock_id", "date", name="uq_price_stock_date"),
        Index("idx_daily_prices_stock_date", "stock_id", "date"),
        Index("idx_daily_prices_date", "date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    date = Column(Date, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    adj_close = Column(Float, nullable=False)
    volume = Column(Integer, nullable=False)
    dividends = Column(Float, default=0)
    stock_splits = Column(Float, default=0)

    stock = relationship("Stock", back_populates="prices")


class Fundamental(Base):
    __tablename__ = "stock_fundamentals"
    __table_args__ = (
        UniqueConstraint("stock_id", "as_of_date", name="uq_fund_stock_date"),
        Index("idx_fundamentals_stock", "stock_id", "as_of_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    as_of_date = Column(Date, nullable=False)

    market_cap = Column(Float)
    pe = Column(Float)
    pb = Column(Float)
    roe = Column(Float)
    roce = Column(Float)
    debt_to_equity = Column(Float)
    dividend_yield = Column(Float)
    eps = Column(Float)
    ebitda = Column(Float)
    free_cash_flow = Column(Float)
    revenue = Column(Float)
    net_income = Column(Float)
    gross_margin = Column(Float)
    operating_margin = Column(Float)
    net_margin = Column(Float)
    revenue_cagr_3y = Column(Float)
    revenue_cagr_5y = Column(Float)
    eps_cagr_3y = Column(Float)
    beta = Column(Float)
    avg_volume_20d = Column(Float)
    week_52_high = Column(Float)
    week_52_low = Column(Float)
    source = Column(Text, default="indian_api")

    stock = relationship("Stock", back_populates="fundamentals")


class TechnicalFeature(Base):
    __tablename__ = "technical_features"
    __table_args__ = (
        UniqueConstraint("stock_id", "date", name="uq_tech_stock_date"),
        Index("idx_technical_stock_date", "stock_id", "date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    date = Column(Date, nullable=False)

    sma_50 = Column(Float)
    sma_200 = Column(Float)
    ema_50 = Column(Float)
    ema_200 = Column(Float)
    rsi_14 = Column(Float)
    macd = Column(Float)
    macd_signal = Column(Float)
    macd_histogram = Column(Float)
    atr_14 = Column(Float)
    bollinger_upper = Column(Float)
    bollinger_lower = Column(Float)
    bollinger_width = Column(Float)

    volatility_30d = Column(Float)
    volatility_90d = Column(Float)
    max_drawdown_1y = Column(Float)
    sharpe_trailing = Column(Float)
    momentum_12m = Column(Float)

    stock = relationship("Stock", back_populates="technical_features")


class NewsItem(Base):
    __tablename__ = "news_items"
    __table_args__ = (
        UniqueConstraint("stock_id", "url", name="uq_news_stock_url"),
        Index("idx_news_stock_date", "stock_id", "published_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    title = Column(Text, nullable=False)
    summary = Column(Text)
    source = Column(Text)
    url = Column(Text, nullable=False)
    sentiment_score = Column(Float)
    published_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    stock = relationship("Stock")


from sqlalchemy import JSON

class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    user_prompt = Column(Text)  # original plain-English input
    rules_json = Column(JSON, nullable=False)  # structured JSON rules
    strategy_type = Column(Text, default="rule_based")  # "rule_based" | "custom"
    position_sizing = Column(Text, default="equal")  # "equal" or "inverse_volatility"
    universe = Column(Text, default="nifty500")
    status = Column(Text, default="draft")  # draft, backtested, active, archived
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    backtest_results = relationship("BacktestResult", back_populates="strategy")
    allocations = relationship("PortfolioAllocation", back_populates="strategy")


class BacktestResult(Base):
    __tablename__ = "backtest_results"
    __table_args__ = (Index("idx_backtest_strategy", "strategy_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    run_date = Column(DateTime, default=datetime.utcnow)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    initial_capital = Column(Float, nullable=False)

    final_value = Column(Float)
    cagr = Column(Float)
    total_return = Column(Float)
    max_drawdown = Column(Float)
    sharpe_ratio = Column(Float)
    sortino_ratio = Column(Float)
    calmar_ratio = Column(Float)
    volatility = Column(Float)
    win_rate = Column(Float)
    total_trades = Column(Integer)
    avg_trade_return = Column(Float)
    benchmark_return = Column(Float)

    transaction_cost_bps = Column(Float)
    slippage_bps = Column(Float)

    equity_curve_json = Column("equity_curve", JSON)  # JSON: [{date, value}]
    monthly_returns_json = Column("monthly_returns", JSON)
    trade_log_json = Column("trade_log", JSON)
    parameters_json = Column("parameters", JSON)
    holdings_json = Column("holdings", JSON)

    strategy = relationship("Strategy", back_populates="backtest_results")


class PortfolioAllocation(Base):
    __tablename__ = "portfolio_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    backtest_id = Column(Integer, ForeignKey("backtest_results.id"))
    allocation_method = Column(Text, nullable=False)  # equal_weight, risk_parity, mvo
    capital = Column(Float, nullable=False)
    allocations_json = Column("allocations", JSON, nullable=False)  # [{symbol, weight, shares, value}]
    regime = Column(Text)  # bull, bear, sideways
    created_at = Column(DateTime, default=datetime.utcnow)

    strategy = relationship("Strategy", back_populates="allocations")


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("idx_alerts_strategy", "strategy_id"),
        Index("idx_alerts_unread", "is_read", "triggered_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    alert_type = Column(Text, nullable=False)  # thesis_break, rebalance, regime_change
    severity = Column(Text, default="info")  # info, warning, critical
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    condition_json = Column("condition", JSON)
    is_read = Column(Boolean, default=False)
    triggered_at = Column(DateTime, default=datetime.utcnow)




class BrokerAccount(Base):
    __tablename__ = "broker_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    broker_name = Column(Text, nullable=False)           # 'zerodha', 'dhan', 'groww'
    account_label = Column(Text, nullable=False)         # "Retirement", "Trading", etc.
    account_purpose = Column(Text)                       # 'long_term_wealth', 'active_trading', 'retirement', etc.
    credentials_encrypted = Column(Text, nullable=False) # Fernet-encrypted JSON
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime)
    sync_status = Column(Text, default='never')          # 'never', 'syncing', 'success', 'error'
    sync_error = Column(Text)
    holdings_count = Column(Integer, default=0)
    total_invested = Column(Float, default=0)
    total_current_value = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    holdings = relationship("Holding", back_populates="broker_account")

class Holding(Base):
    __tablename__ = "holdings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    broker_account_id = Column(Integer, ForeignKey("broker_accounts.id"), nullable=True)
    
    quantity = Column(Integer, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    acquired_date = Column(Date)
    notes = Column(Text)
    
    source = Column(Text, default="csv")                # 'csv', 'zerodha', 'dhan', 'groww'
    broker_trading_symbol = Column(Text)                # Original symbol from broker
    isin = Column(Text)                                 # ISIN for cross-broker deduplication
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stock = relationship("Stock")
    broker_account = relationship("BrokerAccount", back_populates="holdings")


class RegimeHistory(Base):
    __tablename__ = "regime_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, unique=True)
    regime = Column(Text, nullable=False)  # bull, bear, sideways
    nifty_close = Column(Float)
    nifty_sma200 = Column(Float)
    india_vix = Column(Float)
    detection_method = Column(Text, default="ma_based")
    created_at = Column(DateTime, default=datetime.utcnow)


class SchedulerLog(Base):
    __tablename__ = "scheduler_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_name = Column(Text, nullable=False)
    status = Column(Text, nullable=False)  # started, completed, failed
    message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
