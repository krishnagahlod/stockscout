# StockScout v2 — Master Implementation Plan

## Executive Summary

**StockScout** is a rebranded, cloud-hosted evolution of the current AI Investment Co-Pilot. It merges two visions: the existing tool's powerful AI strategy builder + backtesting engine with the StockScout PRD's multi-user personalized screening, stock-checking, and compliance-first design.

### Key Decisions Captured

| Decision | Choice |
|----------|--------|
| **Product Name** | StockScout |
| **Hosting** | Vercel (frontend) + Railway (FastAPI) + Supabase (DB + Auth) |
| **Frontend** | Next.js 16 + TailwindCSS v4 + shadcn/ui + Framer Motion |
| **Backend** | Hybrid: Next.js API routes (CRUD/auth) + FastAPI (compute) |
| **Database** | Supabase Postgres (free tier, fresh start — no SQLite migration) |
| **Auth** | Supabase Auth (Google OAuth + email/password), invite-only |
| **LLM** | Cerebras API (ChatGPT 120B) for: news summary, sentiment, strategy parsing, thesis generation |
| **Data Sources** | Indian API (primary) + yfinance (historical price fallback) |
| **Stock Universe** | NSE + BSE (broader than current Nifty 500 only) |
| **Compliance** | Full SEBI framing as per PRD (non-dismissable banner, restricted vocabulary) |
| **Repo Structure** | Monorepo: `/frontend` + `/backend` |
| **Phasing** | 4 phases over 10-12 weeks |
| **Migration** | Fresh start in Supabase — no SQLite data migration |

---

## Architecture

```mermaid
graph TB
    subgraph Vercel["Vercel (Frontend + API Routes)"]
        NextJS["Next.js 16 App Router"]
        APIRoutes["API Routes (CRUD/Auth proxy)"]
        ServerActions["Server Actions & RSC"]
    end

    subgraph Railway["Railway (Compute Backend)"]
        FastAPI["FastAPI"]
        Backtester["Backtesting Engine"]
        Scorer["Scoring Engine"]
        PortOpt["Portfolio Optimizer"]
        RegimeDetector["Regime Detector"]
    end

    subgraph Supabase["Supabase (Data + Auth)"]
        Postgres["PostgreSQL + RLS"]
        Auth["Supabase Auth"]
        Cron["Edge Functions (cron)"]
    end

    subgraph External["External APIs"]
        IndianAPI["Indian API (RapidAPI)"]
        YFinance["yfinance (fallback)"]
        Cerebras["Cerebras API (ChatGPT 120B)"]
    end

    NextJS -->|fetch| APIRoutes
    APIRoutes -->|CRUD, auth| Supabase
    APIRoutes -->|compute tasks| FastAPI
    FastAPI -->|read/write| Supabase
    Cron -->|daily refresh| IndianAPI
    Cron -->|cache to| Postgres
    FastAPI -->|historical prices| YFinance
    APIRoutes -->|news summary, sentiment, strategy chat| Cerebras
```

### Communication Flow

1. **User → Next.js (Vercel)**: All UI rendering, client-side state (React Query + Zustand)
2. **Next.js API Routes → Supabase**: Direct Supabase client for CRUD operations (stocks, holdings, profiles, alerts), auth management
3. **Next.js API Routes → FastAPI (Railway)**: Proxied calls for compute-heavy tasks (backtesting, scoring, portfolio optimization, regime detection)
4. **Next.js API Routes → Cerebras**: LLM calls (news summary, sentiment scoring, strategy parsing, thesis generation) — always server-side, never from client
5. **Supabase Edge Functions (cron)**: Daily data refresh after market close (3:30 PM IST), fetching from Indian API and caching to Postgres
6. **FastAPI → Supabase**: Direct Postgres connection for reading price/fundamental data during compute tasks

---

## Database Schema (Supabase Postgres)

### Core Tables (14 total)

> [!IMPORTANT]
> All user-specific tables enforce Row-Level Security (RLS) via `user_id = auth.uid()`. Shared data tables (stocks, prices, fundamentals, news) are read-only for all authenticated users.

#### Shared Data (no RLS write restrictions — populated by cron/admin)

```sql
-- Stock universe (NSE + BSE)
CREATE TABLE stocks (
    id BIGSERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,              -- e.g. "RELIANCE"
    exchange TEXT NOT NULL,            -- "NSE" or "BSE"
    isin TEXT UNIQUE,                  -- International Securities ID
    name TEXT NOT NULL,
    sector TEXT,
    industry TEXT,
    market_cap_cr NUMERIC,
    is_index_member BOOLEAN DEFAULT FALSE,  -- NIFTY 500 / SENSEX etc.
    index_name TEXT,                    -- Which index
    listed_date DATE,
    last_refreshed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker, exchange)
);

-- Daily price data (OHLCV)
CREATE TABLE daily_prices (
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
    source TEXT DEFAULT 'indian_api',  -- 'indian_api' or 'yfinance'
    UNIQUE(stock_id, date)
);
CREATE INDEX idx_prices_stock_date ON daily_prices(stock_id, date);
CREATE INDEX idx_prices_date ON daily_prices(date);

-- Fundamentals snapshot (one row per stock per day, refreshed daily)
CREATE TABLE stock_fundamentals (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    market_cap NUMERIC,
    pe NUMERIC,                        -- Trailing P/E
    pb NUMERIC,                        -- Price to Book
    roe NUMERIC,                       -- Return on Equity (%)
    roce NUMERIC,                      -- Return on Capital Employed (%)
    debt_to_equity NUMERIC,
    dividend_yield NUMERIC,            -- (%)
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
CREATE INDEX idx_fundamentals_stock ON stock_fundamentals(stock_id, as_of_date);

-- News items per stock
CREATE TABLE news_items (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    source TEXT,
    url TEXT,
    published_at TIMESTAMPTZ,
    plain_language_summary TEXT,        -- LLM-generated
    sentiment TEXT,                     -- 'positive', 'neutral', 'negative'
    sentiment_score NUMERIC,           -- -1.0 to 1.0
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_news_stock ON news_items(stock_id, published_at DESC);

-- Technical features (computed from prices)
CREATE TABLE technical_features (
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

-- Regime history (market-wide)
CREATE TABLE regime_history (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    regime TEXT NOT NULL,               -- 'bull', 'bear', 'sideways'
    nifty_close NUMERIC,
    nifty_sma200 NUMERIC,
    india_vix NUMERIC,
    detection_method TEXT DEFAULT 'ma_based'
);
```

#### User-Specific Data (RLS enforced: `user_id = auth.uid()`)

```sql
-- User profile with risk appetite
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT,
    risk_appetite TEXT NOT NULL DEFAULT 'moderate',  -- 'conservative', 'moderate', 'aggressive'
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User portfolio holdings
CREATE TABLE holdings (
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

-- Personalized score results (historical)
CREATE TABLE score_results (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    fundamentals_score NUMERIC,         -- 0-100
    sector_score NUMERIC,               -- 0-100
    news_score NUMERIC,                 -- 0-100
    combined_score NUMERIC,             -- 0-100 weighted
    risk_band TEXT,                      -- user's risk band at time of scoring
    score_breakdown JSONB               -- detailed factor breakdown for explainability
);
CREATE INDEX idx_scores_user ON score_results(user_id, computed_at DESC);

-- Strategies (from AI builder or manual screener)
CREATE TABLE strategies (
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

-- Backtest results
CREATE TABLE backtest_results (
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

-- Portfolio allocations
CREATE TABLE portfolio_allocations (
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

-- Alerts
CREATE TABLE alerts (
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
```

---

## Risk Band Definitions (Initial Defaults)

These will be tunable later. Starting points:

| Metric | Conservative | Moderate | Aggressive |
|--------|-------------|----------|------------|
| **Beta** | < 0.8 | 0.8 – 1.3 | > 1.0 (no upper cap) |
| **ROE** | > 15% | > 10% | > 8% (growth matters more) |
| **ROCE** | > 18% | > 12% | > 8% |
| **Debt/Equity** | < 0.3 | < 0.8 | < 1.5 |
| **Market Cap** | Large-cap preferred (> ₹20,000 Cr) | Mid + Large (> ₹5,000 Cr) | All caps (> ₹1,000 Cr) |
| **Volatility (90d)** | < 25% annualized | < 35% | No restriction |
| **Dividend Yield** | > 2% (bonus weight) | No preference | No preference |
| **Revenue CAGR 3Y** | > 5% | > 10% | > 15% (heavily weighted) |
| **Scoring emphasis** | Stability, cash flow, dividends | Balanced growth + quality | Growth, momentum, high beta |

---

## Compliance Enforcement Architecture

```mermaid
graph LR
    subgraph Components
        Banner["ComplianceBanner (non-dismissable)"]
        Wrapper["ScoreWrapper component"]
        Vocab["VocabularyGuard (text filter)"]
    end
    
    Banner -->|wraps| Wrapper
    Wrapper -->|wraps every score screen| Pages["All Score/Screening/Check Pages"]
    Vocab -->|sanitizes| LLMOutput["LLM Generated Text"]
```

- **`ComplianceBanner`**: Persistent top banner on every page showing scores: *"Informational tool. Not investment advice. Scores reflect your stated criteria, not a recommendation to buy or sell."*
- **`ScoreWrapper`**: HOC wrapping any component that displays scores, ensuring the banner + factor breakdown is always present
- **`VocabularyGuard`**: Utility that sanitizes LLM output, replacing banned terms (`buy`, `sell`, `recommend`, `should`, `best stock`) with approved vocabulary (`scores well`, `fits your criteria`, `worth a closer look`)

---

## Caching & Data Refresh Strategy

| Data Type | Refresh Frequency | Cache Location | Source |
|-----------|-------------------|---------------|--------|
| Stock universe (NSE+BSE) | Quarterly | Supabase `stocks` table | Indian API |
| Daily prices (OHLCV) | Daily after 3:30 PM IST | Supabase `daily_prices` | Indian API (primary), yfinance (fallback) |
| Fundamentals snapshot | Daily after market close | Supabase `stock_fundamentals` | Indian API |
| News items | Every 4 hours during trading hours | Supabase `news_items` | Indian API + Cerebras (summary) |
| Technical indicators | Daily (computed from prices) | Supabase `technical_features` | Computed by FastAPI |
| Score results | On-demand (when holdings change or user requests) | Supabase `score_results` | Computed by FastAPI |
| Market regime | Daily | Supabase `regime_history` | Computed by FastAPI |

**NSE Market Calendar Awareness**: The cron job checks NSE trading calendar (via Indian API) before running, skipping exchange holidays so data isn't marked as "refreshed" on non-trading days.

---

## Phased Implementation Plan

### Phase 1: Core Infrastructure + Stock Profiles + Auth (Weeks 1-3)

> Foundation: auth, data pipeline, stock profiles, project restructuring

#### 1.1 Project Restructuring
- [MODIFY] Restructure repo as monorepo: `/frontend` (Next.js) + `/backend` (FastAPI)
- [NEW] Root `README.md` with project overview, setup instructions
- [NEW] Root `docker-compose.yml` for local development (optional)
- [MODIFY] Update `.gitignore` for monorepo structure

#### 1.2 Supabase Setup
- [NEW] Supabase project creation (free tier)
- [NEW] All 14 database tables with proper indices
- [NEW] Row-Level Security policies for user-specific tables
- [NEW] Supabase Auth configuration (Google OAuth + email/password)
- [NEW] Invite-only account creation flow (Krishna as admin)

#### 1.3 Frontend Foundation
- [MODIFY] Rebrand to "StockScout" (titles, metadata, logos)
- [NEW] Supabase client integration (`@supabase/ssr` for Next.js)
- [NEW] Auth pages: Login, Signup (invite-only), Profile setup
- [NEW] Onboarding flow: risk appetite selection on first login
- [MODIFY] Layout: responsive sidebar with mobile hamburger menu
- [NEW] Dark/light theme toggle (using `next-themes`)
- [NEW] `ComplianceBanner` component
- [NEW] Framer Motion page transitions and micro-animations
- [MODIFY] Global CSS polish (typography, color palette, spacing)

#### 1.4 Data Pipeline v2
- [NEW] Supabase Edge Function: daily stock data refresh cron job
- [NEW] Indian API integration service (Next.js server-side)
- [NEW] yfinance fallback service for historical prices (FastAPI)
- [NEW] Stock universe sync (NSE + BSE from Indian API)
- [NEW] Fundamentals fetch + cache pipeline
- [NEW] News fetch + LLM summarization pipeline (Cerebras)

#### 1.5 Stock Profile Page
- [NEW] `/stocks/[ticker]` page with:
  - Current price, day range, 52-week range
  - Fundamentals grid (P/E, P/B, ROE, ROCE, D/E, dividend yield, market cap)
  - "Recently listed" badge for IPOs < 2 quarters
  - Recent news panel (5 items, LLM-summarized)
  - Interactive price chart (historical)
- [NEW] Stock search with autocomplete

#### 1.6 FastAPI Backend Setup on Railway
- [MODIFY] Update FastAPI to connect to Supabase Postgres (not SQLite)
- [NEW] Railway deployment config
- [NEW] Health check + API key auth between Vercel and Railway
- [NEW] Technical feature computation service (migrated from current)

---

### Phase 2: Personalized Screening + Portfolio Tracking (Weeks 4-6)

> Core StockScout features: holdings, screener, check-my-stock

#### 2.1 Risk Profile & Portfolio
- [NEW] `/portfolio` page with:
  - Holdings entry (stock, quantity, avg buy price, date)
  - Holdings CRUD (add/edit/delete)
  - Total portfolio value at current prices
  - Unrealized P&L per holding and overall
  - Sector allocation pie chart
  - Portfolio metrics summary

#### 2.2 Personalized Screener (3-Factor Scoring)
- [NEW] Scoring engine in FastAPI:
  - Factor 1: Fundamentals-fit-to-risk-band (50% weight)
  - Factor 2: Sector-concentration fit (30% weight) — skipped if zero holdings
  - Factor 3: News sentiment (20% weight) — Cerebras sentiment scoring
  - Combined weighted score (0-100)
- [NEW] `/screener` page redesign:
  - Top 10 stocks by combined score
  - Three-factor breakdown visualization per stock (small bars or radar)
  - Auto-recompute when holdings change
  - Score history over time per stock
  - Compliance wrapper with factor visibility

#### 2.3 Check-My-Stock Tool
- [NEW] `/check-stock` page:
  - Stock ticker input (with autocomplete)
  - Optional: quantity/amount being considered
  - Same 3-factor scoring as screener for that single stock
  - Portfolio impact view: before/after sector allocation comparison
  - Fundamentals comparison against user's current holdings averages
  - Framed as "how this fits your situation" — never yes/no

#### 2.4 Manual Filter Builder (Enhanced)
- [MODIFY] Migrate current filter builder to work with Supabase data
- [MODIFY] Add more metrics from Indian API
- [NEW] Save/load filter presets

---

### Phase 3: Strategy Builder + Backtesting (Weeks 7-9)

> Carry forward the existing AI strategy builder and backtesting engine

#### 3.1 AI Strategy Builder
- [MODIFY] Migrate LLM calls from Groq to Cerebras API
- [MODIFY] Update prompt templates for Cerebras model
- [NEW] Vocabulary guard applied to all LLM outputs
- [MODIFY] Strategy persistence to Supabase (with `user_id`)
- [MODIFY] Goal selector, progress steps, strategy preview — all with RLS
- [NEW] Chat history persistence (stored in Supabase, survives page refresh)

#### 3.2 Backtesting Engine
- [MODIFY] Migrate backtester to read from Supabase Postgres
- [MODIFY] Optimize data loading (batch queries, not N+1)
- [MODIFY] All backtest results stored with `user_id` in Supabase
- [NEW] Backtest comparison view (compare 2+ backtests side-by-side)
- [MODIFY] Equity chart, drawdown chart, monthly heatmap — Framer Motion animations

#### 3.3 Portfolio Optimization
- [MODIFY] Migrate portfolio optimizer to Supabase data source
- [MODIFY] Store allocations per user with RLS
- [NEW] Export allocation as CSV/PDF

---

### Phase 4: Polish + Advanced Features (Weeks 10-12)

> Alerts, regime detection, final polish, performance optimization

#### 4.1 Alerts & Monitoring
- [MODIFY] Alert system with per-user storage (RLS)
- [NEW] Thesis break detection tied to user's active strategies
- [NEW] Rebalance reminders based on drift thresholds
- [NEW] In-app notification bell + optional email alerts (Supabase Edge Functions)

#### 4.2 Regime Detection
- [MODIFY] Migrate regime service to Supabase
- [MODIFY] Display regime on dashboard and portfolio pages

#### 4.3 UI/UX Polish
- [NEW] Loading skeletons on all data-dependent pages
- [NEW] Error boundaries with graceful fallbacks
- [NEW] Smooth page transitions (Framer Motion)
- [NEW] Chart interactivity improvements (tooltips, zoom, pan)
- [NEW] Mobile responsive layout throughout
- [NEW] Keyboard shortcuts for power users
- [NEW] Onboarding tutorial (first-time walkthrough)

#### 4.4 Performance & Production Hardening
- [NEW] API rate limiting on FastAPI endpoints
- [NEW] Request caching (React Query + server-side ISR)
- [NEW] Database query optimization (batch fetches, materialized views for scores)
- [NEW] Error logging and monitoring (Sentry or similar)
- [NEW] E2E tests for critical flows (auth → screening → backtest)

#### 4.5 Dashboard Redesign
- [MODIFY] Personalized dashboard per user:
  - Portfolio snapshot (total value, P&L, top movers)
  - Top 3 screener picks (quick glance)
  - Recent alerts
  - Market regime badge
  - Latest strategy/backtest summary
  - Quick actions (Check stock, Run screener, Build strategy)

---

## API Architecture

### Next.js API Routes (Vercel) — Light CRUD + Auth + LLM Proxy

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...supabase]` | * | Supabase Auth callbacks |
| `/api/stocks` | GET | List/search stocks (paginated) |
| `/api/stocks/[ticker]` | GET | Stock profile + fundamentals + news |
| `/api/holdings` | GET/POST/PUT/DELETE | User portfolio CRUD |
| `/api/profile` | GET/PUT | User risk profile |
| `/api/llm/summarize-news` | POST | News summarization (Cerebras) |
| `/api/llm/strategy-chat` | POST | Strategy builder chat (Cerebras) |
| `/api/llm/explain-rules` | POST | Rules explanation (Cerebras) |
| `/api/llm/thesis` | POST | Thesis generation (Cerebras) |
| `/api/alerts` | GET/PUT | Alerts list + mark read |

### FastAPI Routes (Railway) — Compute-Heavy

| Route | Method | Purpose |
|-------|--------|---------|
| `/compute/score` | POST | 3-factor personalized scoring |
| `/compute/check-stock` | POST | Single stock evaluation + portfolio impact |
| `/compute/backtest` | POST | Run portfolio backtest |
| `/compute/optimize` | POST | Portfolio optimization |
| `/compute/technicals` | POST | Compute technical features |
| `/compute/regime` | GET | Current market regime |
| `/compute/health` | GET | Service health check |

**Auth between Vercel ↔ Railway**: Shared API secret key in environment variables. All calls from Vercel to Railway include this key in an `X-API-Key` header. FastAPI validates it on every request.

---

## Environment Variables

### Vercel (Next.js)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cerebras LLM
CEREBRAS_API_KEY=csk_...

# Indian API (RapidAPI)
INDIAN_API_KEY=xxx
INDIAN_API_HOST=indian-stock-exchange-api2.p.rapidapi.com

# FastAPI Backend
FASTAPI_URL=https://stockscout-api.up.railway.app
FASTAPI_SECRET=shared_secret_key

# Feature flags
ENABLE_BACKTEST=true
ENABLE_STRATEGY_BUILDER=true
```

### Railway (FastAPI)
```env
# Supabase (direct Postgres connection)
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres

# Shared auth secret
API_SECRET_KEY=shared_secret_key

# yfinance (no key needed)
PRICE_SYNC_START_DATE=2015-01-01

# Defaults
DEFAULT_TX_COST_BPS=20.0
DEFAULT_SLIPPAGE_BPS=10.0
RISK_FREE_RATE=0.06
```

---

## Key Technical Decisions

### 1. Why Hybrid Backend (Not Pure Next.js)
Backtesting loads 500 stocks × 10 years of daily prices into memory, performs vectorized computations with numpy/pandas, and can run for 30+ seconds. This is unsuitable for Vercel's serverless functions (10-second timeout on free tier, 60s on Pro). Railway provides a persistent Python process with no timeout concerns, plus access to numpy/pandas/ta libraries.

### 2. Why Fresh Data Start (Not SQLite Migration)
The current SQLite schema differs significantly from the new Postgres schema (different column names, no RLS, no user_id). Indian API provides richer, more reliable fundamentals than the current yfinance-scraped data. Starting fresh ensures data consistency and avoids migration complexity.

### 3. Why Cerebras for LLM (Not Groq/Claude)
User's choice. Cerebras provides free access to ChatGPT 120B model. Will be used for: news summarization, sentiment scoring, strategy parsing, thesis generation, and rules explanation. Deterministic scoring logic remains in Python (not LLM-dependent) for reproducibility and trust.

### 4. JSONB vs Separate Tables for Backtest Results
Equity curves, trade logs, and monthly returns are stored as JSONB in the `backtest_results` table (same approach as current tool) because they're write-once-read-many and their schema varies per backtest configuration. This avoids 500K+ rows in a separate trade_log table.

---

## Verification Plan

### Automated Tests
- **FastAPI**: pytest for scoring engine, backtest engine, portfolio optimizer
- **Next.js**: Vitest for API routes, React Testing Library for key components
- **E2E**: Playwright for critical flows (login → add holdings → run screener → view results)

### Manual Verification
- Indian API data accuracy: compare fetched fundamentals against Moneycontrol/Screener.in for 10 stocks
- Scoring engine: verify scores change correctly when holdings are modified
- Backtest: reproduce a known buy-and-hold benchmark as sanity check
- Compliance: audit all screens for banned vocabulary
- RLS: verify user A cannot access user B's data via API manipulation
- Mobile: test all pages on iPhone/Android viewport sizes

---

## Open Items for Later Discussion

1. **Indian API rate limits**: Need to check current free tier quotas before committing to refresh frequency
2. **Cerebras API specifics**: Will need API key and model endpoint details to build the integration
3. **Risk band thresholds**: Defaults provided above, to be refined after initial testing with real data
4. **Email notifications**: Supabase Edge Functions can send emails, but need to decide if this is worth the complexity for v2
5. **PDF export**: Was in the original plan (Phase 8) — deferring to post-v2 unless you want it sooner
6. **Sector taxonomy**: Indian API may use different sector/industry classifications than yfinance — need to map and normalize

> [!IMPORTANT]
> This plan covers ALL 10 features you selected as must-have. The 4-phase approach ensures each phase delivers a usable, testable increment. Phase 1 alone gives you a working app with auth + stock profiles. Each subsequent phase adds a major feature set.

**Ready to proceed? If this plan looks good, I'll start execution from Phase 1.**
