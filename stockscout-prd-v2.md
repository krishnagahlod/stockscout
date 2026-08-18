# PRD: StockScout — AI-Powered Stock Research & Screening Platform for NSE/BSE

## Overview

StockScout brings together prices, fundamentals, news, and AI-driven analysis for Indian equities (NSE/BSE) in one place, built for a small trusted group (Krishna plus friends/juniors) rather than the general public. It does two jobs: surface a personalized shortlist of stocks worth researching based on each user's risk appetite and current portfolio, and let a user sanity-check a specific stock they're already considering. It is a research and screening tool, not an investment advisory service, and that framing is enforced at the UI level, not just in a disclaimer.

## Compliance framing (this shapes every feature below, not just legal boilerplate)

SEBI requires that any stock buy/sell recommendation be attributed to a SEBI-registered Research Analyst or Investment Adviser, whether AI-generated or not, and has specifically ruled that "educational" framing does not exempt tools that give trading calls, including inside private groups. A friend-group tool sharing stock calls is precisely the scenario SEBI has taken enforcement action on. Decision: StockScout is built entirely around score/screener language, never recommendation language, enforced as follows:
- Every screen showing a score or the stock-check output carries a persistent, non-dismissable banner: "Informational tool. Not investment advice. Scores reflect your stated criteria, not a recommendation to buy or sell."
- No UI copy anywhere uses "best stock," "buy," "sell," "recommend," or "should." Approved vocabulary: "scores well against your criteria," "fits your risk profile," "worth a closer look."
- Every score is shown with its contributing factors visible (see Feature 2 below), never as a bare number, so nothing reads as an unexplained call.
- If StockScout ever expands beyond this friend group to the general public, this framing needs re-review with an actual SEBI-registered adviser before that expansion, since the compliance posture that works for a private circle does not automatically hold at public scale.

## Goals and non-goals

**Goals**
- One place for NSE/BSE prices, fundamentals, and recent news per stock
- A personalized screener per user that accounts for their risk appetite and full existing portfolio (rebalancing-aware)
- A "check this stock" tool that evaluates a candidate purchase against the user's existing portfolio and risk profile
- Each of the friend group's data (portfolio, scores) private to them

**Non-goals for V1**
- No brokerage integration or trade execution
- No intraday/real-time tick data; end-of-day data refreshed after market close is sufficient for this use case
- No options chain, F&O, mutual funds, or non-INR instruments
- No public signup; access is invite-only within the friend group for V1

## Target users

Krishna and a small group of friends/juniors: students or early-career people with some capital to invest, limited time for deep research, and varying familiarity with investing terminology. The interface explains scoring factors in plain language (e.g. "this company owes relatively little compared to what it earns" rather than a bare debt-to-equity ratio) rather than assuming financial literacy.

## Data source decision

**Decision: Indian API (dev.indianapi.in, distributed via RapidAPI) is the single data vendor for prices, fundamentals, forecasts, and news.** It covers company fundamentals, historical financials, analyst forecasts, and curated NSE/BSE news in one unified REST API, purpose-built for exactly this use case.

This was chosen over the obvious alternative, Zerodha's Kite Connect, for a specific reason worth stating plainly: Kite Connect's own terms say it is an order-execution platform, not a data distribution service, and explicitly prohibit displaying or redistributing its data to other users on an external platform. Since StockScout serves multiple friends viewing shared data infrastructure (even though each sees their own portfolio), that is precisely the redistribution Kite's terms disallow, regardless of good intent. Indian API is licensed as a data vendor for this kind of use, which avoids that problem entirely and also bundles fundamentals and news that Kite Connect doesn't provide at all (Kite Connect only covers prices and order data; fundamentals and news would have needed a second vendor regardless).

Practical implications for the build: start on Indian API's free/basic tier during development and internal testing; move to its paid tier once the friend group is actively using it daily, since the free tier's request quota won't hold up under multiple people refreshing scores. Cache end-of-day data server-side (see Non-functional requirements) so the group's combined usage doesn't multiply API calls linearly with user count.

## Core features

### Feature 1: Stock profile and news

Each stock has a profile page showing: current price and day range, 52-week range, market cap, P/E, P/B, ROE, ROCE, debt-to-equity, dividend yield, and sector/industry. Below that, a "Recent news" panel shows the 5 most recent news items for that stock from Indian API's news endpoint, each summarized by Claude into one plain-language sentence rather than showing the raw headline feed, since raw financial headlines are often dense with jargon a non-specialist friend won't parse quickly.

Data entities: `Stock` (ticker, exchange, name, sector, industry), `StockFundamentals` (stock_id, as_of_date, market_cap, pe, pb, roe, roce, debt_to_equity, dividend_yield — snapshotted daily so historical comparison is possible later), `NewsItem` (stock_id, headline, source, published_at, plain_language_summary).

Edge case: newly listed stocks (IPO'd in the last 1-2 quarters) will have incomplete fundamentals history. The profile page shows what's available and displays "Limited history, recently listed" instead of blank fields or a zero, so it doesn't read as the stock scoring zero on unavailable metrics.

### Feature 2: Risk profile and portfolio

Each user sets a risk appetite (conservative / moderate / aggressive) on signup, editable anytime. Each user enters their current holdings: stock, quantity, average buy price, and date acquired. From this, StockScout computes and displays: total portfolio value at current prices, unrealized gain/loss per holding and overall, and sector allocation as a percentage breakdown.

Data entities: `UserProfile` (user_id, risk_appetite, created_at), `Holding` (user_id, stock_id, quantity, avg_buy_price, acquired_date).

Edge case: a user with zero holdings (new to the group or hasn't entered anything yet) sees the screener (Feature 3) run purely on risk appetite with sector-concentration scoring skipped, and a visible note explaining that adding holdings will make the shortlist portfolio-aware.

### Feature 3: Personalized screener ("stocks worth a closer look")

For each user, StockScout computes a score for a candidate universe of stocks (starting universe: NIFTY 500 constituents, refreshed quarterly since index membership changes) using three weighted factors:

1. **Fundamentals-fit-to-risk-band (50% weight).** Each risk band maps to target ranges for volatility proxy (beta, if available from Indian API; otherwise trailing 1-year price standard deviation computed from historical data) and profitability metrics (ROE/ROCE thresholds). Conservative favors low beta, high ROCE, low debt-to-equity, established large-cap. Aggressive allows higher beta and smaller-cap names with strong growth metrics even at higher volatility. A stock scores higher the closer it sits to its band's target range.
2. **Sector-concentration fit (30% weight).** Compares the candidate stock's sector against the user's current portfolio sector allocation (Feature 2). A stock in a sector the user is already heavily concentrated in (above 30% of portfolio value) scores lower on this factor; a stock in an underrepresented or absent sector scores higher. Users with zero holdings skip this factor and it's excluded from the weighting (fundamentals-fit becomes 70%, news-sentiment 30%) rather than defaulting to zero.
3. **Recent news sentiment (20% weight).** Claude scores the tone of the last 5 news items for each candidate stock (positive/neutral/negative) and this contributes a small positive or negative adjustment. This is deliberately the lowest-weighted factor since news sentiment is noisy and short-lived compared to fundamentals and portfolio fit.

The screener returns the top 10 stocks by combined score, and recomputes automatically whenever the user's holdings change (not on a fixed schedule), since the sector-concentration factor depends directly on current holdings. Each result shows its three factor scores as a simple breakdown (e.g. three small bars or a short line: "Strong fundamentals fit, improves your sector diversification, neutral recent news") so the reasoning is visible, per the compliance framing above.

Data entity: `ScoreResult` (user_id, stock_id, computed_at, fundamentals_score, sector_score, news_score, combined_score) — stored historically so a user can see how a stock's score has moved over time, not just the latest snapshot.

### Feature 4: Check-my-stock

A user enters a specific stock they're considering buying (and optionally a quantity/amount). StockScout runs the same three-factor logic from Feature 3 against that single stock, then adds a portfolio-impact view: what the user's sector allocation would look like after this purchase (before/after comparison), and how this stock's fundamentals compare specifically against the user's current holdings' average metrics (e.g. "your current holdings average 14% ROE; this stock is at 22%").

This is framed explicitly as "here's how this fits your situation," never a yes/no verdict, consistent with the compliance framing. Output structure mirrors Feature 3's factor breakdown plus the before/after portfolio comparison.

## Access and accounts

Invite-only for V1: Krishna creates accounts for friends directly (via Supabase Auth, email + password) rather than open signup, since this is a closed friend group and open signup adds surface area (spam accounts, unclear compliance posture if a stranger joins) without any benefit at this scale. Each user's `Holding`, `UserProfile`, and `ScoreResult` rows are isolated via Supabase row-level security keyed to `user_id`, so no user can query another's portfolio data even by manipulating client requests.

## Tech stack and architecture

- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion for score-reveal animations and portfolio visualizations
- **Backend/data**: Supabase (Postgres + Auth + row-level security)
- **Hosting**: Vercel
- **Market/fundamentals/news data**: Indian API (see Data source decision above), called from server-side Next.js API routes only, never directly from the client, both to keep the API key secret and to allow response caching
- **AI layer**: Claude API for two specific jobs only, kept separate from the deterministic scoring logic: (1) summarizing news items into plain language, (2) scoring news sentiment as an input to Feature 3/4. The core fundamentals-fit and sector-concentration scoring is deterministic code (not an LLM call), so a user's score doesn't vary between two runs with no underlying data change, which matters both for trust and for the compliance framing (an explainable, reproducible score reads very differently from an opaque AI verdict)

## Non-functional requirements

- **Caching**: fundamentals and news are end-of-day data; fetch once per trading day per stock and cache in Supabase rather than calling Indian API per user request, so the group's combined usage doesn't scale API calls with user count. A scheduled Vercel cron job (or Supabase scheduled function) refreshes the cache after NSE market close (3:30 PM IST) on trading days only.
- **Market calendar awareness**: the refresh job checks the NSE trading calendar (available from Indian API) rather than running on a fixed weekday schedule, so it correctly skips exchange holidays and doesn't show stale data labeled as current.
- **Data isolation**: enforced via Supabase row-level security as described above, not just application-layer checks, so isolation holds even if a client-side bug attempts to query another user's data.
- **Compliance enforcement at the component level**: the disclaimer banner and vocabulary restrictions (see Compliance framing) are implemented as a shared component wrapping every score-bearing screen, so a future new screen inherits the disclaimer by default rather than requiring someone to remember to add it.
- **Cost containment**: Indian API's free tier is sufficient for development and initial testing with the caching strategy above; budget for its paid tier once the friend group is using it daily, since the specific quota depends on Indian API's current plan terms at time of signup and should be checked directly on dev.indianapi.in before committing.
