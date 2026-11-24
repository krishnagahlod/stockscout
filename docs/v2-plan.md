# StockScout v2 Plan

*Draft for review, 24 Nov 2026. Decisions recorded the same day.*

How StockScout becomes the place Indian students check before they invest: everything they need in one calm place, simple on top, with depth for those who want it. Based on research into student investors, SEBI rules, Indian market data, what pro terminals show, and the TradeWise terminal.

## Build status

Phase 1, in the agreed order. Ticked items are built (24 Nov 2026).

- [x] Wording pass: rank facts instead of verdicts, split calculator, landing example on 19 Oct 2026 closes
- [x] Start here (/start): three questions, Nifty 50 facts from our own data, Nifty 50 ETFs from three fund houses
- [x] Tip checker (/check): hype phrases, companies named, red flags from real numbers, names outside the Nifty 500
- [x] Stock page v2: TradingView Lightweight Charts (line, candles, vs Nifty 50, 50/200-day averages), worst-case line, "above its 50-day average since"
- [x] Practice mode (/practice): ₹1,00,000 of pretend money, buy and sell at the latest close, "try this idea with practice money"
- [x] Market today (/market): one-line summary, industry map, big movers, breadth
- [ ] AI explainer (waiting for the Groq key)

Data fixes made along the way:

- Filled a hole in price history: 235 stocks were missing 23 Feb to 21 Jul 2026 (22,314 days added).
- Nightly price repair (backend/app/services/price_cleaning.py): drops empty and bad rows, adjusts splits and bonus issues Yahoo left unadjusted. Rows changed on 24 Nov are backed up in the table `daily_prices_backup_20261124`.
- The Nifty 500 universe no longer includes 37 custom rows created by CSV imports.
- Added the Nifty 50 index and six ETFs to the nightly sync.

## Decisions (24 Nov 2026)

- **Calls:** StockScout will register its own research analyst licence later. No calls until then.
- **Phase 1 order:** as below.
- **Mutual funds:** full coverage from AMFI's daily file in Phase 2. Phase 1 adds a handful of ETFs for "Start here".
- **AI:** Groq. Key and model name to follow; the AI explainer waits for them.
- **Friend's terminal:** TradeWise ([tradewise-v1.duckdns.org](https://tradewise-v1.duckdns.org/welcome)). We take ideas, not code. See "What to bring in from TradeWise" below.

## Five decisions this plan rests on

- **Build for the nervous first-time student, delivery-only.** No futures and options on the main path. Long-term buying and holding is the whole product.
- **Every screen has three layers.** A one-line answer anyone can read, an explained card, and a full pro view behind "Go deeper".
- **No buy or sell "calls" until a SEBI-registered research analyst stands behind them.** Until then StockScout matches companies to the student's own criteria and says so.
- **All data is collected nightly into our own database,** and we move to sources that allow display to other people before going public.
- **Build next:** a wording pass on what exists, a "Start here" path, a tip checker, a richer stock page with real charts, a practice mode, and a market-today page.

## Why this can work

Young Indians are arriving in the market in large numbers, but most of them are scared, underinformed and learning from group chats. Brokers earn when people trade, so a calm, neutral guide that never executes trades has a real gap to fill.

- **59%** of new investor registrations in Apr to Jun 2026 were under 30. Under-30s are now about 38% of India's 13.2 crore investors.
- **63% vs 9.5%:** households that know about stocks and funds versus those that actually invest. Fear of loss, complexity and low trust are the top reasons (SEBI survey 2025).
- **About 7.8 crore of 23.4 crore** demat accounts made a trade in the last 12 months. Many people open an account and then freeze.
- **88 to 91%** of individual F&O traders lose money year after year. Under-30s are about 43% of those traders (SEBI studies FY22 to FY26).
- **82 stocks,** mostly small SME companies, were pumped and dumped through X, Telegram and WhatsApp in a case SEBI acted on in May 2026.
- **79%** of Gen Z households describe themselves as risk-averse. The product should lower fear, not add excitement.

Several figures come from news summaries of SEBI and NSE reports. Check them against the primary documents before quoting them publicly.

## Who it's for

Three students, often the same person at different moments.

- **The starter.** Has ₹500 to ₹5,000 a month from pocket money or a stipend. Maybe just opened a demat account. Asks: what do I do with my first money, and how do I not lose it?
- **The tip follower.** Has a demat account and buys what the group chat or a finfluencer says. Asks: is this tip safe, and how bad could it get?
- **The curious one.** Knows the basics, has read some Varsity, wants depth without a trader's terminal. Asks: show me the real numbers, charts and comparisons, explained.

## What students need, and what StockScout does about it

Ranked by importance from the research.

| # | The student's question | What StockScout does | Phase |
| --- | --- | --- | --- |
| 1 | I have my first ₹500 to ₹5,000. Index fund, ETF or a stock? | "Start here": goal, timeline and emergency-money check, then an index-ETF-first path with optional stocks on top. | 1 |
| 2 | Is this tip from my group safe? | Tip checker: type a name or paste the message, get red flags in plain words (tiny company, sudden spike, losses, heavy debt, not in the Nifty 500, hype words). | 1 |
| 3 | What does this number mean? | Tap-to-explain on every number (already built), plus 2-minute lessons linked where the number appears. | 1 and 2 |
| 4 | How bad can it get? | Worst-case line on every stock and on the portfolio: "₹1,000 here fell to ₹680 at its worst point last year." | 1 |
| 5 | Should I hold or sell? I'm panicking. | Check-ins: what changed since you bought, and whether the reasons you bought still hold. Facts, never a sell call. | 2 |
| 6 | How do I open a demat account and finish KYC? | A step-by-step guide that doesn't favour any broker, with real costs. | 2 |
| 7 | What tax do I pay on small gains? | Tax helper on holdings: short- and long-term gains explained with your own numbers. | 2 |
| 8 | Can I practise first? | Practice mode: a virtual ₹1,00,000 portfolio with real prices. | 1 |
| 9 | Keep track of it all for me. | Portfolio (built) plus a weekly 3-line email. | 2 |
| 10 | Compare two companies simply. | Side-by-side compare of 2 to 3 companies, same three layers. | 2 |

## Three layers on every screen

Layer 1 is one sentence a beginner can read. Layer 2 is a small explained card or chart. Layer 3 is the full pro view, opened only when someone taps "Go deeper". The beginner never has to see Layer 3, and the curious student never hits a wall.

| Screen | Layer 1: glance | Layer 2: understand | Layer 3: go deeper |
| --- | --- | --- | --- |
| Stock | "Profitable, borrows little, priced below its own 5-year average." | Scorecard for business, price and trend with plain percentiles; 1-year chart and 52-week range; similar companies; worst-case line. | Candle chart with volume, moving averages and RSI; compare to Nifty; financial statements; valuation history bands; ownership and pledges; events and deals. |
| Market | "Nifty up 0.6% today. Banks led, IT lagged." | Sector heatmap, biggest movers among large companies, foreign and domestic fund flows by month. | Market breadth, daily flows history, sector rotation over time, India VIX. |
| Portfolio | "Worth ₹42,300, up ₹1,200 this month." | Industry spread, health check, worst case for the whole portfolio. | Per-holding history, buy lots, annual return (XIRR), tax view. |
| Ideas | "9 companies match what you asked for." | Each company with its reasons; the rules in words; a split calculator you control. | Edit the rules yourself; historical test with honest warnings. |
| Learn | The one-line meaning next to each number. | A 2-minute lesson card with a real example. | Links to the matching Zerodha Varsity chapter for the full story. |

Patterns to copy: word labels like Tickertape's scorecard, one glanceable visual like Simply Wall St's snowflake, inline help at the moment of decision. Patterns to avoid: a single score that reads as "buy", all-green dashboards that nudge action, jargon in Layer 1.

## About "calls": what we can do and when

Buy, sell and hold views, price targets and stop-losses are "research services" under SEBI's Research Analyst rules, and giving them needs registration. Being free does not exempt us, because SEBI counts any economic benefit, direct or indirect, as payment. AI doesn't change this: if our AI says "buy X, target ₹Y", that is our call.

**Recent enforcement shows SEBI means it.** An unregistered trading "academy" was ordered to give up ₹546 crore in Dec 2025 for calls dressed up as education. Telegram channel operators were barred in Apr 2026 for a "free" channel that fed paid tips.

### The path (decided: our own licence)

- **Now (closed friend group).** No calls. StockScout shows companies that match the student's own criteria, with factual comparisons ("profit on owners' money: top 20% of the Nifty 500") instead of verdicts. The budget split is a calculator the student controls.
- **Before going public.** A wording audit across the app, data dates everywhere, a clear "information, not a recommendation" line, and one opinion from a securities lawyer.
- **Calls through our own registration.** Register the company as a research analyst once the principal officer has a graduate degree and the NISM Series XV certificate. Costs: ₹20,000 application and ₹30,000 registration for a company, plus a ₹1 lakh deposit for up to 150 clients. Ongoing work: client KYC, audits, record keeping. The part-time route probably doesn't fit a founder who also runs a stock app.
- **Fallback:** partner with a registered research analyst whose research appears under their name and number (the Smallcase, Univest and Dhan model). For this to stay possible, the platform must stay free of unregistered tips.

### Words we use and words we avoid

| Avoid | Use instead |
| --- | --- |
| Buy / sell / hold / accumulate | Matches the filters you set |
| Target ₹X, stop-loss ₹Y | Alert me if it falls below ₹Y (a level the student sets) |
| Top picks for you, best stocks to buy | Companies matching what you asked for |
| Strong business (as a verdict) | Profit on owners' money: top 20% of the Nifty 500 |
| Your plan: buy 6 ITC | Split calculator: you picked these 3, here is how ₹5,000 divides |
| AI advisor | AI explainer |
| BUY since 3 Nov (a signal) | Price above its 50-day average since 3 Nov (a fact) |
| Up 40% since we found it | (no return claims about our lists, ever) |

Community features need care too. Since Aug 2024 SEBI-registered firms may not associate with anyone giving unregistered tips or making return claims. Any community must forbid stock-specific calls and return claims.

## Data: what we use now, and what we switch to before going public

The key finding: **free to download is not the same as free to show other people.** Yahoo Finance data is for personal use. NSE's website terms forbid automated scraping, and NSE owns the market data. For a closed friend group the risk is low. Before a public launch we move to official download files and ask NSE in writing.

| Need | Now (closed group) | Before going public | Notes |
| --- | --- | --- | --- |
| Daily prices and corporate actions | Yahoo, nightly (working) | NSE and BSE end-of-day "bhavcopy" files, nightly; Yahoo as fallback | Official download files. Showing them to users still needs NSE's confirmation. |
| Delivery % (shares actually taken home) | Not yet | NSE's full bhavcopy file, which carries delivery quantity | TradeWise is built on this. Useful for the tip checker. |
| Company numbers and statements | Yahoo, weekly | Quarterly results filings (XBRL) from NSE and BSE, parsed ourselves, or a licensed vendor such as IndianAPI (from about ₹399 a month) | Screener.in, Tickertape and Trendlyne have no public API. We won't scrape them. |
| Ownership, pledges | Not yet | Quarterly shareholding filings (XBRL) | Promoter, foreign and domestic fund stakes, pledged shares. |
| Events: results dates, dividends, splits | Yahoo corporate actions | NSE and BSE announcements, cached nightly | Low volume, cached, never real-time. |
| Market: fund flows, VIX, sectors | Sector averages from our own snapshot | NSE daily reports, stored nightly to build our own history | NSE shows only the latest day, so we keep the history ourselves. |
| ETFs and mutual funds | ETF prices via Yahoo | AMFI's free daily NAV file for every fund; ETF prices from bhavcopy | Full fund coverage in Phase 2. |
| News | Yahoo news | Headline, source and link only, from publisher feeds and NSE announcements | Always link to the original. No full-article copying. |
| Charts | Recharts | TradingView Lightweight Charts, fed from our own data | Open source (Apache 2.0); shows a small TradingView credit. |
| Real-time prices | Never. Everything is labelled "as of close, date". | | NSE's delayed-data display licence reportedly costs about ₹60,000 to ₹1,10,000 a year per medium. To confirm with NSE. |

## What to bring in from TradeWise

TradeWise is an end-of-day NSE terminal with ten desks (Monitor, Research, Quant lab, Scanner, Long term, News, Edge, Portfolio, Compare, Learn). Its core idea: weight each day's price by delivery volume, and mark the day a stock's trend turns. It is built for people who study charts every evening. StockScout's student wants one answer first, so each useful panel moves into Layer 2 or 3, rewritten as facts.

| TradeWise panel | In StockScout | Where | When |
| --- | --- | --- | --- |
| Trigger status ("T50 BUY since 3 Nov") | "Price has been above its 50-day average since 3 Nov." A fact with a date, not a signal. | Stock page, trend line | Phase 1 |
| Price Chart (candles, EMA overlays, flip markers) | Candle chart with volume and 50- and 200-day averages | Stock page, Go deeper | Phase 1 |
| Alpha vs Index | "Over 1 year this share rose 12%; Nifty 50 rose 8%." Line chart rebased to 100. | Stock page, Layer 2 | Phase 1 |
| Market Monitor, Trigger Flips | Market today: day's move, sector heatmap, biggest movers among large companies | Market page | Phase 1 |
| Delivery Spikes, delivery % pane | "Lots of trading, few shares taken home" as a tip-checker flag | Tip checker, stock Layer 3 | Phase 2 (needs bhavcopy) |
| Results Calendar, NSE announcements | Events calendar on stock pages and holdings | Stock page, Portfolio | Phase 2 |
| Compare (rebased charts, worst fall, beta) | Compare 2 to 3 companies | Compare page | Phase 2 |
| Portfolio (XIRR), Exposure | Annual return and concentration in the portfolio health check | Portfolio, Layer 3 | Phase 2 |
| Learn (ten short lessons) | 2-minute lessons linked from the numbers they explain | Learn | Phase 2 |
| Market News, Stock News | Headlines with source and link | Market page, stock page | Phase 2 |
| Strategy Lab, Saved Runs | Historical test of an idea with honest warnings | Ideas, Go deeper | Phase 3 |
| Long-Term Signals with odds, Long Buy Check, reversal patterns with targets | Not included. These read as buy and sell calls. | | Only after RA registration |
| Volume Profile, TPO, drawing tools, bar replay, breakout scanner | Not included. Trader tools. | | Possible opt-in Pro mode |

A note worth passing to your friend: TradeWise's disclaimer says it isn't SEBI-registered, but labels like "BUY since" and buy/sell signals with odds on named stocks are the kind of output SEBI treats as research. A disclaimer doesn't change that once other people use it.

Also never on the main path: option chain, open interest, put-call ratio, market depth, tick-by-tick data, live gainers and losers. If ever offered, only as an opt-in Pro mode with SEBI's loss figures shown first.

## Roadmap

Effort is a rough size: S about a day, M two to four days, L a week or more.

### Phase 1: Trust and a clear start (about 2 to 3 weeks)

- **Wording pass** (S). Factual labels instead of verdicts on the stock page, a split calculator instead of "Your plan", a landing example on prices more than 30 days old, data dates everywhere.
- **Start here** (M). Goal, timeline and emergency-money check. Short-term money gets a plain explainer on savings, FDs and liquid funds. Long-term money starts with an index ETF, then optional stocks. Adds broad ETFs (Nifty 50, Nifty Next 50, gold, liquid) to our data.
- **Tip checker** (M). Type a company name or paste a forwarded message; get red flags in plain words with the numbers behind them.
- **Stock page v2** (M). Candle chart with volume and averages, compare to Nifty 50, factual scorecard, worst-case line, trend-since date, "Go deeper" for the rest.
- **Practice mode** (M). A virtual ₹1,00,000 portfolio using real prices, kept separate from the real one.
- **Market today** (S). One sentence on the day, a sector heatmap from our own data, the biggest movers among large companies.
- **AI explainer** (S). Once the Groq key is in: typed ideas, "explain this company in 3 lines", and the tip-checker summary. Always written from our numbers, never a call.

### Phase 2: Depth (about 3 to 4 weeks)

- **Mutual funds, full coverage** (M) from AMFI's daily file, with the same three layers.
- **Ownership and pledges** (M) from quarterly filings.
- **Events calendar and announcements** (M).
- **Delivery % and fund flows** (S) from NSE's daily files.
- **Compare companies** (S).
- **Tax helper** (M) on holdings.
- **Weekly email** (S) through Resend.
- **Demat and KYC guide, and 2-minute lessons** (M).
- **Valuation history bands and full financial statements** (M) once quarterly filings are parsed.

### Phase 3: Ready for the public (when the friend group is happy)

- **Data switch** (L) to bhavcopy and filings, and a written answer from NSE on display rights.
- **Legal opinion** from a securities lawyer on the final wording and features.
- **Research analyst registration**, then calls under that licence (L).
- **Opt-in Pro mode** (M) for the deeper terminal panels.
- **Moderated community** (L) with no stock-specific tips or return claims.
- **Installable phone app** (M), a progressive web app first.

## Tech changes

The architecture stays the same: Next.js on Vercel, Supabase with row-level security, and a nightly GitHub Actions job that fills the database. The app only ever reads our own database.

| Change | Why |
| --- | --- |
| ETFs added to `stocks` with an `ETF` sector, excluded from ideas | Start here, and Nifty 50 for comparisons |
| A `portfolio_kind` column on holdings (real or practice) | Practice mode without a second portfolio system |
| `lightweight-charts` package (about 35 KB) | Candles, volume, averages, with TradingView attribution |
| New tables in Phase 2: `stock_events`, `shareholding`, `fund_nav`, `market_daily` | Events, ownership, mutual funds, fund flows |
| Groq key in Vercel (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) | Typed ideas and plain-language explanations |

## Sources

- [SEBI Research Analyst Regulations, consolidated to 25 Nov 2025](https://www.sebi.gov.in/sebi_data/attachdocs/aug-2026/1785912002778.pdf) and [RA FAQs, Jul 2025](https://www.sebi.gov.in/sebi_data/faqfiles/jul-2025/1753269723942.pdf)
- [SEBI guidelines for research analysts, 8 Jan 2025](https://www.sebi.gov.in/legal/circulars/jan-2025/guidelines-for-research-analysts_90634.html) (AI disclosure)
- [SEBI circular on price data for educational purposes, May 2026](https://www.sebi.gov.in/legal/circulars/may-2026/norms-for-sharing-and-usage-of-price-data-for-educational-purposes_101293.html)
- [Business Standard on the ₹546 crore order, Dec 2025](https://www.business-standard.com/amp/markets/news/avadhut-sathe-finfluencer-sebi-ban-disgorgement-unregistered-advisory-125120500178_1.html) and [ANI on the May 2026 pump-and-dump case](https://aninews.in/news/business/sebi-cracks-down-on-finfluencer-pump-and-dump-network-warns-retail-investors-against-social-media-stock-tips20260523110908/)
- [NSE Market Pulse, Jan 2026](https://nsearchives.nseindia.com/web/mediaattachment/2026-01/Market_Pulse_January_2026_FINAL.pdf) and [SEBI Investor Survey 2025 coverage](https://www.business-standard.com/markets/news/two-thirds-of-domestic-households-aware-of-securities-products-sebi-survey-126012100349_1.html)
- [SEBI F&O loss study coverage, FY25](https://www.business-standard.com/amp/markets/news/net-losses-of-traders-in-fo-widens-in-fy25-sebi-study-125070701221_1.html)
- [NSE terms of use](https://www.nseindia.com/static/nse-terms-of-use) and [NSE delayed-data tariff](https://archives.nseindia.com/content/press/Snapshot_15_delayed_data.pdf)
- [AMFI daily NAV file](https://portal.amfiindia.com/spages/NAVAll.txt)
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts)
- [CMU: design patterns of trading apps and their effect on investing behaviour](https://www.cs.cmu.edu/~chinmayk/assets/pdfs/Design_Patterns_of_Trading_Apps_and_Their_Effects_on_Investing_Behaviors_accepted.pdf)

The SEBI analysis is a careful reading of the rules, not legal advice; get a securities lawyer's opinion before a public launch or any calls.
