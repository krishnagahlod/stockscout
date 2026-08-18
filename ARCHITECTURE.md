# StockScout: AI-Powered Stock Research & Screening Platform

This document serves as the comprehensive technical guide for **StockScout**, detailing its architecture, design decisions, data flow, tradeoffs, and compliance constraints. It is intended to be the definitive source of truth for the system.

---

## 1. Executive Summary

StockScout is a personalized, AI-driven stock research and screening platform designed for Indian equities (NSE/BSE). Unlike typical generic stock screeners, StockScout combines:
- **Fundamental & Technical Screening**
- **LLM-driven News Sentiment Analysis**
- **Portfolio-Aware Risk Filtering** (dynamic scoring based on a user's existing holdings and risk appetite)

Built for a small, trusted group rather than the general public, the tool serves as a "sanity-check" copilot rather than an investment advisory platform.

---

## 2. Compliance & Product Framing (Critical)

A major design driver for StockScout is compliance with SEBI (Securities and Exchange Board of India) regulations. SEBI requires buy/sell recommendations to be attributed to a registered Research Analyst or Investment Adviser.

**Design Decisions to Mitigate Risk:**
- **No Advisory Vocabulary:** The UI never uses terms like "buy," "sell," "best stock," or "recommend." Instead, it uses neutral framing: "scores well against your criteria," "fits your risk profile," or "worth a closer look."
- **Explainability over Black-Box Scoring:** Every score displays its contributing factors (e.g., Fundamentals fit, Sector fit, News sentiment). The core scoring is **deterministic**, not an LLM hallucination, ensuring reproducibility.
- **Persistent Disclaimers:** A non-dismissible banner warns users that the tool provides informational data, not investment advice.
- **Closed Ecosystem:** The platform is currently invite-only (via Supabase Auth) for a close-knit group to prevent unauthorized public redistribution.

---

## 3. High-Level Architecture

StockScout operates on a modern, decoupled web architecture tailored for performance, privacy, and low-cost maintenance.

### **Tech Stack**
- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend/API:** FastAPI (Python), SQLAlchemy (Async), Uvicorn
- **Database:** PostgreSQL (via Supabase) with Row-Level Security (RLS) for data isolation
- **Data Vendors:** 
  - **Indian API** (via RapidAPI): Primary source for EOD prices, fundamentals, news, and forecasts.
  - *Previous/Fallback:* `yfinance` for fast prototyping.
- **AI/LLM Layer:** 
  - Local LLMs (Ollama + Llama/Mistral) for private, zero-cost parsing.
  - Remote APIs (OpenAI/Claude) for complex sentiment and news summary tasks.
- **Task Scheduling:** APScheduler for automated backend background tasks.

### **System Data Flow**
1. **User Intent:** The user submits a plain-English prompt (e.g., "Find high-dividend, low-volatility stocks").
2. **NLP Parsing:** The backend sends the prompt to the LLM to extract structured JSON (filters, timeframes, targets).
3. **Data Retrieval:** The backend evaluates the filters against pre-cached end-of-day data in the PostgreSQL DB.
4. **Scoring Engine:** A deterministic composite score is generated using weighted factors (Fundamentals, Sector Concentration, News Sentiment).
5. **UI Rendering:** Next.js consumes the API response and renders interactive dashboards, backtest charts, and plain-English AI explanations.

---

## 4. Core Subsystems

### 4.1. Data Ingestion & Storage Layer
**Goal:** Reliable, cost-effective storage for historical price data, fundamentals, and news.
- **Why Indian API?** Zerodha's Kite Connect explicitly prohibits data redistribution to a multi-user platform. Indian API bundles fundamentals, news, and prices under a compliant data vendor license.
- **Caching Strategy:** Because API limits are strict (especially on free/basic tiers), end-of-day data is fetched once per trading day (post 3:30 PM IST) and cached in Postgres. Individual users querying the data hit the local database, not the external API.

### 4.2. Deterministic Scoring Engine
For personalized screening, a candidate stock's score is a weighted sum of:
1. **Fundamentals-Fit (50%):** Matches ROE, debt, and volatility to the user's defined risk band (Conservative, Moderate, Aggressive).
2. **Sector-Concentration (30%):** Penalizes stocks belonging to sectors where the user is already heavily over-indexed (>30% of portfolio). Requires real-time awareness of user holdings.
3. **News Sentiment (20%):** An LLM evaluates the tone of the last 5 news items (Positive/Neutral/Negative). Deliberately given the lowest weight to prevent noise.

### 4.3. Backtesting Engine
Simulates historical performance to validate strategies.
- **Implementation:** Vectorized operations via `vectorbt` for immense speed, falling back to event-driven engines like `backtrader` for granular execution constraints (e.g., exact slippage, liquidity constraints).
- **Checks & Balances:** Accounts for corporate actions (splits/dividends) and transaction costs (slippage, brokerage fees, STT/taxes).

### 4.4. Portfolio Construction & Rebalancing
The AI transitions from a "stock picker" to a "portfolio manager".
- **Allocation Rules:** Equal weight, Volatility scaling (Risk Parity), or Mean-Variance Optimization (PyPortfolioOpt).
- **Rebalance Engine:** Can trigger on a calendar basis (quarterly) or threshold drift.
- **Execution Generation:** Generates actionable rebalance plans indicating exact quantities to buy/sell to align the current portfolio with the target rules.

### 4.5. Automated Task Scheduler (APScheduler)
**Role:** Keeps data fresh and strategies monitored without manual intervention.
- **Lifespan Bootstrapping:** FastAPI uses `lifespan` context managers to check data freshness on startup. If data is older than 12 hours, an asynchronous full-sync is triggered.
- **Background Refresh:** Evaluates strategy drift, updates EOD stock prices, and recalculates market regimes daily.

---

## 5. Design Decisions & Tradeoffs

| Decision | Alternative Considered | Reasoning |
| :--- | :--- | :--- |
| **Deterministic Scoring** | End-to-End LLM evaluation | LLMs hallucinate and yield non-deterministic results. A mathematical scoring engine provides reproducible, explainable metrics vital for financial tools and compliance. |
| **Indian API** | Zerodha Kite Connect | Kite Connect violates redistribution terms for a multi-user portal. Indian API offers an integrated suite of prices, fundamentals, and news. |
| **PostgreSQL (Supabase)** | MongoDB or SQLite | Relational data integrity is critical for financial metrics. Supabase brings built-in Row-Level Security (RLS) guaranteeing user A cannot view user B's portfolio. |
| **APScheduler (In-App)** | Celery / Airflow | Celery requires a separate Redis broker and worker nodes, which increases hosting complexity and costs for a small-scale app. APScheduler runs within the FastAPI process. |
| **Local LLM parsing** | 100% OpenAI GPT-4 | High recurring API costs. Local LLMs (Ollama) map intent-to-JSON for free, preserving privacy. Cloud APIs are reserved for complex reasoning (e.g., parsing news tone). |

---

## 6. Current State & Future Roadmap

**Currently Implemented:**
- End-to-End full stack Next.js + FastAPI integration.
- Intelligent data synchronization (startup & background polling).
- Market Regime detection (Bull, Bear, Sideways) widgets.
- Custom Strategy builder with plain-English chat parsing.
- Dynamic Rebalance Plan generation.

**Roadmap (To Production-Grade):**
1. **Live Brokerage Execution:** One-click execution integrating the Rebalance output with Upstox/Zerodha APIs.
2. **Survivorship Bias Mitigation:** Ingesting historical Nifty 500 constituents to ensure backtests aren't running only on "companies that survived."
3. **Macro-Economic Awareness:** Feeding interest rate and inflation data into the Regime detector to auto-adjust portfolio aggressiveness.
4. **Enhanced Tax Simulation:** Implementing precise STCG / LTCG / STT impacts into the backtest reports.

---

## 7. Development Guidelines

1. **Local-First Testing:** Validate data pipelines locally using Docker to avoid spamming the production Postgres instance or exhausting API quotas.
2. **API Wrappers:** All frontend queries must route through `frontend/src/lib/api.ts` using `@tanstack/react-query` to ensure consistent caching and error boundaries.
3. **Compliance UI:** Any component displaying an evaluation score must wrap the content in the `DisclaimerBanner` component.
4. **Strict Typing:** Backend `Pydantic` schemas and Frontend `TypeScript` interfaces must remain synchronized. Use `any` bypasses only as a temporary hotfix for mocked data.
