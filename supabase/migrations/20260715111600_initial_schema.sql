-- Supabase Migration: Initial Schema for StockScout v2

-- 1. Shared Data Tables (No RLS write restrictions for normal users, read-only for public/auth users)

-- Stock universe (NSE + BSE)
CREATE TABLE IF NOT EXISTS stocks (
    id BIGSERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    exchange TEXT NOT NULL,            -- "NSE" or "BSE"
    isin TEXT UNIQUE,                  -- International Securities ID
    name TEXT NOT NULL,
    sector TEXT,
    industry TEXT,
    market_cap_cr NUMERIC,
    is_index_member BOOLEAN DEFAULT FALSE,  -- e.g., NIFTY 500
    index_name TEXT,
    listed_date DATE,
    last_refreshed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker, exchange)
);

-- Enable read access for authenticated users
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stocks are readable by everyone" ON stocks FOR SELECT USING (true);

-- Daily price data (OHLCV)
CREATE TABLE IF NOT EXISTS daily_prices (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    open NUMERIC NOT NULL,
    high NUMERIC NOT NULL,
    low NUMERIC NOT NULL,
    close NUMERIC NOT NULL,
    adj_close NUMERIC,
    volume BIGINT NOT NULL,
    dividends NUMERIC DEFAULT 0,
    stock_splits NUMERIC DEFAULT 0,
    source TEXT DEFAULT 'indian_api',
    UNIQUE(stock_id, date)
);
CREATE INDEX IF NOT EXISTS idx_prices_stock_date ON daily_prices(stock_id, date);
CREATE INDEX IF NOT EXISTS idx_prices_date ON daily_prices(date);

ALTER TABLE daily_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily prices are readable by everyone" ON daily_prices FOR SELECT USING (true);

-- Fundamentals snapshot
CREATE TABLE IF NOT EXISTS stock_fundamentals (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    market_cap NUMERIC,
    pe NUMERIC,
    pb NUMERIC,
    roe NUMERIC,
    roce NUMERIC,
    debt_to_equity NUMERIC,
    dividend_yield NUMERIC,
    eps NUMERIC,
    ebitda NUMERIC,
    free_cash_flow NUMERIC,
    revenue NUMERIC,
    net_income NUMERIC,
    gross_margin NUMERIC,
    operating_margin NUMERIC,
    net_margin NUMERIC,
    revenue_cagr_3y NUMERIC,
    revenue_cagr_5y NUMERIC,
    eps_cagr_3y NUMERIC,
    beta NUMERIC,
    avg_volume_20d NUMERIC,
    week_52_high NUMERIC,
    week_52_low NUMERIC,
    source TEXT DEFAULT 'indian_api',
    UNIQUE(stock_id, as_of_date)
);
CREATE INDEX IF NOT EXISTS idx_fundamentals_stock ON stock_fundamentals(stock_id, as_of_date);

ALTER TABLE stock_fundamentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fundamentals are readable by everyone" ON stock_fundamentals FOR SELECT USING (true);

-- News items
CREATE TABLE IF NOT EXISTS news_items (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    source TEXT,
    url TEXT,
    published_at TIMESTAMPTZ,
    plain_language_summary TEXT,
    sentiment TEXT,
    sentiment_score NUMERIC,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_stock ON news_items(stock_id, published_at DESC);

ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News items are readable by everyone" ON news_items FOR SELECT USING (true);

-- Technical features
CREATE TABLE IF NOT EXISTS technical_features (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sma_50 NUMERIC, sma_200 NUMERIC,
    ema_50 NUMERIC, ema_200 NUMERIC,
    rsi_14 NUMERIC,
    macd NUMERIC, macd_signal NUMERIC, macd_histogram NUMERIC,
    atr_14 NUMERIC,
    bollinger_upper NUMERIC, bollinger_lower NUMERIC, bollinger_width NUMERIC,
    volatility_30d NUMERIC, volatility_90d NUMERIC,
    max_drawdown_1y NUMERIC,
    sharpe_trailing NUMERIC,
    momentum_12m NUMERIC,
    UNIQUE(stock_id, date)
);
ALTER TABLE technical_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Technical features are readable by everyone" ON technical_features FOR SELECT USING (true);

-- Regime history
CREATE TABLE IF NOT EXISTS regime_history (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    regime TEXT NOT NULL,
    nifty_close NUMERIC,
    nifty_sma200 NUMERIC,
    india_vix NUMERIC,
    detection_method TEXT DEFAULT 'ma_based'
);
ALTER TABLE regime_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regime history is readable by everyone" ON regime_history FOR SELECT USING (true);


-- 2. User-Specific Data Tables (RLS strictly enforced based on auth.uid())

-- User profile
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT,
    risk_appetite TEXT NOT NULL DEFAULT 'moderate',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Holdings
CREATE TABLE IF NOT EXISTS holdings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    avg_buy_price NUMERIC NOT NULL,
    acquired_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own holdings" ON holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own holdings" ON holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own holdings" ON holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own holdings" ON holdings FOR DELETE USING (auth.uid() = user_id);

-- Score results
CREATE TABLE IF NOT EXISTS score_results (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    fundamentals_score NUMERIC,
    sector_score NUMERIC,
    news_score NUMERIC,
    combined_score NUMERIC,
    risk_band TEXT,
    score_breakdown JSONB
);
CREATE INDEX IF NOT EXISTS idx_scores_user ON score_results(user_id, computed_at DESC);

ALTER TABLE score_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own score results" ON score_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own score results" ON score_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Strategies
CREATE TABLE IF NOT EXISTS strategies (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    user_prompt TEXT,
    rules_json JSONB NOT NULL,
    universe TEXT DEFAULT 'nifty500',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own strategies" ON strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own strategies" ON strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strategies" ON strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own strategies" ON strategies FOR DELETE USING (auth.uid() = user_id);

-- Backtest results
CREATE TABLE IF NOT EXISTS backtest_results (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id BIGINT REFERENCES strategies(id) ON DELETE CASCADE,
    run_date TIMESTAMPTZ DEFAULT NOW(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital NUMERIC NOT NULL,
    final_value NUMERIC,
    cagr NUMERIC, total_return NUMERIC, max_drawdown NUMERIC,
    sharpe_ratio NUMERIC, sortino_ratio NUMERIC, calmar_ratio NUMERIC,
    volatility NUMERIC, win_rate NUMERIC,
    total_trades INTEGER, benchmark_return NUMERIC,
    transaction_cost_bps NUMERIC, slippage_bps NUMERIC,
    equity_curve JSONB,
    monthly_returns JSONB,
    trade_log JSONB,
    holdings JSONB,
    parameters JSONB
);

ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own backtest results" ON backtest_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backtest results" ON backtest_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own backtest results" ON backtest_results FOR DELETE USING (auth.uid() = user_id);

-- Portfolio allocations
CREATE TABLE IF NOT EXISTS portfolio_allocations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id BIGINT REFERENCES strategies(id) ON DELETE CASCADE,
    backtest_id BIGINT REFERENCES backtest_results(id),
    allocation_method TEXT NOT NULL,
    capital NUMERIC NOT NULL,
    allocations JSONB NOT NULL,
    regime TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portfolio_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own portfolio allocations" ON portfolio_allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio allocations" ON portfolio_allocations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio allocations" ON portfolio_allocations FOR DELETE USING (auth.uid() = user_id);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id BIGINT REFERENCES strategies(id),
    stock_id BIGINT REFERENCES stocks(id),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    condition JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON alerts FOR DELETE USING (auth.uid() = user_id);
