// Run: npm run check:rules (compiles with tsc, runs with node, exits non-zero on failure)
import assert from "node:assert/strict";
import { makePlan, runRules, sanitizeRules, type Pick } from "../rules";
import type { StockSnapshot } from "../metrics";

const base = { industry: null, is_index_member: true, price_date: "2026-09-09", prev_close: null, close_1y_ago: null,
  fundamentals_date: null, pb: null, eps: null, net_margin: null, operating_margin: null, beta: null, week_52_high: null,
  week_52_low: null, technicals_date: null, rsi_14: null, sma_200: null, max_drawdown_1y: null, momentum_12m: null,
  dividend_yield: null, debt_to_equity: null, pe: null, volatility_30d: null } as const;
const stock = (id: number, sector: string, roe: number | null, price: number): StockSnapshot =>
  ({ ...base, stock_id: id, ticker: `S${id}.NS`, name: `S${id}`, sector, market_cap_cr: 1000 * id, roe, price });

const universe = [stock(1, "IT", 0.3, 100), stock(2, "IT", 0.25, 200), stock(3, "IT", 0.2, 300), stock(4, "Bank", 0.18, 50), stock(5, "Bank", null, 10)];
const rules = sanitizeRules({ name: "q", filters: [{ metric: "roe", op: ">", value: 0.15 }, { metric: "nonsense", op: ">", value: 1 }],
  rank_by: [{ metric: "roe", prefer: "high", weight: 1 }], count: 10 }, ["IT", "Bank"])!;

assert.equal(rules.filters.length, 1, "unknown metrics are dropped");
const { picks, matched } = runRules(rules, universe);
assert.equal(matched, 4, "missing ROE fails the filter");
assert.deepEqual(picks.map((p) => p.stock.stock_id), [1, 2, 4], "best first, max 2 per sector");
assert.ok(picks[0].reasons[0].startsWith("Profit on owners' money: 30.0%"));

const plan = makePlan(picks as Pick[], 1000);
const spent = plan.lines.reduce((a, l) => a + l.cost, 0);
assert.ok(spent <= 1000 && plan.leftover === 1000 - spent && plan.leftover < 50, "budget is spent in whole shares");
assert.deepEqual(makePlan([{ stock: stock(9, "IT", 0.3, 5000), score: 1, reasons: [] }], 1000).tooExpensive, ["S9.NS"]);
assert.equal(sanitizeRules({ filters: [] }, []), null, "empty rules rejected");
console.log("rules check: ok");

// --- portfolio summary
import { summarize } from "../portfolio";
{
  const a = { ...stock(1, "IT", 0.3, 110), prev_close: 100 };
  const b = { ...stock(2, "Bank", 0.2, 50) };
  const snaps = new Map([[1, a], [2, b]]);
  const s = summarize([
    { id: 1, stock_id: 1, quantity: 10, avg_buy_price: 100 },
    { id: 2, stock_id: 1, quantity: 10, avg_buy_price: 120 },
    { id: 3, stock_id: 2, quantity: 2, avg_buy_price: 50 },
    { id: 4, stock_id: 99, quantity: 1, avg_buy_price: 1 },
  ], snaps);
  assert.equal(s.positions[0].quantity, 20, "lots of the same stock are merged");
  assert.equal(s.value, 2300);
  assert.equal(s.invested, 2300);
  assert.equal(Math.round(s.dayPnl), 200, "day change from prev close");
  assert.equal(s.unpriced, 1);
  assert.ok(s.checks.some((c) => c.title.includes("in one company")));
  const etf = { ...stock(50, "ETF", null, 100), name: "Nifty ETF" };
  const f = summarize([{ id: 9, stock_id: 50, quantity: 10, avg_buy_price: 100 }], new Map([[50, etf]]));
  assert.ok(!f.checks.some((c) => c.title.includes("one company") || c.title.startsWith("Only")), "a single broad ETF is not concentration");
  assert.ok(f.checks.some((c) => c.tone === "good" && c.title.includes("ETFs")));
  console.log("portfolio check: ok");
}

// Glance cards state rank, not verdicts
import { rankOf, standing, stockGlance } from "../glance";
{
  assert.equal(rankOf([1, 2, 3, 4], 3.5), 0.75);
  assert.equal(standing(0.83), "top 15%");
  assert.equal(standing(0.995), "top 5%", "never 'top 0%'");
  assert.equal(standing(0.2), "bottom 20%");
  assert.equal(stockGlance({ ...stock(9, "IT", 0.2, 10), debt_to_equity: 0.1 }, { pos: "close to", years: 5 }), "Profitable, borrows little and its P/E is close to its own 5-year middle.");
  assert.equal(stockGlance({ ...stock(9, "Financial Services", -0.1, 10), debt_to_equity: 8 }, null), "Made a loss in its latest year.", "lenders' debt isn't judged");
  assert.equal(stockGlance(stock(9, "IT", null, 10), null), null);
  console.log("glance check: ok");
}

// Worst fall and recovery from daily closes
import { grownFrom, monthsBetween, rolling, sma, trendSince, worstFall } from "../risk";
{
  const pts = [["2020-01-01", 100], ["2020-02-01", 120], ["2020-03-01", 60], ["2020-06-01", 90], ["2020-09-01", 125], ["2020-10-01", 110]]
    .map(([date, close]) => ({ date: date as string, close: close as number }));
  const f = worstFall(pts)!;
  assert.equal(f.fall, -0.5, "120 -> 60 is the worst fall");
  assert.equal(f.peakDate, "2020-02-01");
  assert.equal(f.troughDate, "2020-03-01");
  assert.equal(f.recoveredDate, "2020-09-01", "first close back at or above 120");
  assert.equal(worstFall([pts[0], pts[1]]), null, "only rising: no fall");
  assert.equal(grownFrom(pts, "2020-02-15", 1000)!.value, 1000 * 110 / 60);
  assert.equal(monthsBetween("2020-02-01", "2020-09-01"), 7);
  const yr = [["2019-01-01", 100], ["2019-07-01", 80], ["2020-01-01", 90], ["2020-07-01", 120]].map(([date, close]) => ({ date: date as string, close: close as number }));
  const r1 = rolling(yr, 1)!;
  assert.equal(r1.count, 2, "two full 1-year windows");
  assert.equal(r1.lossShare, 0.5, "100->90 lost, 80->120 gained");
  assert.equal(rolling(yr, 5), null, "no 5-year window yet");
  const tp = [10, 10, 10, 8, 8, 12, 13].map((close, i) => ({ date: `2026-01-0${i + 1}`, close }));
  assert.deepEqual(sma(tp, 3).slice(0, 4), [null, null, 10, 28 / 3]);
  assert.deepEqual(trendSince(tp, 3), { above: true, since: "2026-01-06" }, "crossed above its 3-day average on the 6th");
  console.log("risk check: ok");
}

// Tip checker
import { findMentions, hypeWords, tipFlags } from "../tips";
{
  const msg = "🚀 SURE SHOT multibagger! Buy COALINDIA and Infra Corp now, TGT 600. Also XYZSME will hit upper circuit. Join our VIP group";
  const h = hypeWords(msg);
  for (const w of ["sure shot", "multibagger", "target", "upper circuit", "VIP or paid group", "hype emojis"]) assert.ok(h.includes(w), `hype: ${w}`);
  assert.deepEqual(hypeWords("Coal India results were steady this quarter."), []);
  assert.ok(hypeWords("my friend says its going to double").includes("double your money"));

  const u = [
    { ...base, stock_id: 1, ticker: "COALINDIA.NS", name: "Coal India Ltd.", sector: "Energy", market_cap_cr: 240000, roe: 0.28, price: 380 },
    { ...base, stock_id: 2, ticker: "INFRACORP.NS", name: "Infra Corp Ltd.", sector: "Energy", market_cap_cr: 3000, roe: 0.05, price: 50, eps: -2 },
    { ...base, stock_id: 3, ticker: "IDEA.NS", name: "Vodafone Idea Ltd.", sector: "Telecom", market_cap_cr: 50000, roe: null, price: 8, eps: 3.4, net_margin: 0.8, operating_margin: -0.05 },
  ] as StockSnapshot[];
  const m = findMentions(msg, u);
  assert.deepEqual(m.found.map((s) => s.stock_id).sort(), [1, 2], "caps ticker and name core");
  assert.deepEqual(m.unknown, ["XYZSME"], "unknown caps word, stop-words ignored");
  assert.equal(findMentions("I have a good idea", u).found.length, 0, "lowercase 'idea' in a sentence is not a ticker");
  assert.equal(findMentions("coal india", u).found[0].stock_id, 1, "short text is a search");

  const hist = Array.from({ length: 70 }, (_, i) => ({ date: `d${i}`, close: i < 55 ? 100 : 140 }));
  const { flags } = tipFlags(u[1], u, hist);
  assert.ok(flags[0].level === "red", "red flags first");
  assert.ok(flags.some((f) => f.text.includes("up 40% in the past month")), "month spike");
  assert.ok(flags.some((f) => f.text.includes("loss")), "loss");
  assert.ok(tipFlags(u[2], u, hist).flags.some((f) => f.text.includes("day-to-day business lost money")), "one-off profit");
  const lowDeliv = hist.map((p, i) => ({ ...p, delivery_pct: i > 64 ? 18 : 55 }));
  assert.ok(tipFlags(u[1], u, lowDeliv).flags.some((f) => f.text.includes("same-day trading")), "spike on low delivery");
  assert.equal(tipFlags(u[1], u, hist, 0.4).flags.find((f) => f.text.includes("pledged"))?.level, "red", "heavy pledge is red");
  assert.equal(tipFlags(u[1], u, hist, 0.1).flags.find((f) => f.text.includes("pledged"))?.level, "amber", "some pledge is amber");
  assert.ok(!tipFlags(u[1], u, hist, 0.01).flags.some((f) => f.text.includes("pledged")), "a tiny pledge isn't flagged");
  assert.ok(!tipFlags(u[1], u, hist.map((p) => ({ ...p, delivery_pct: 55 }))).flags.some((f) => f.text.includes("same-day")), "normal delivery: no flag");
  console.log("tips check: ok");
}

// Practice mode replay
import { PRACTICE_CASH, replay } from "../practice";
{
  const t = (id: number, stock_id: number, quantity: number, price: number) => ({ id, stock_id, quantity, price, traded_at: "2026-11-24T10:00:00Z" });
  const r = replay([t(1, 7, 10, 100), t(2, 7, 10, 200), t(3, 7, -5, 300), t(4, 8, 2, 50), t(5, 8, -9, 60)]);
  assert.equal(r.holdings.find((h) => h.stock_id === 7)!.quantity, 15);
  assert.equal(r.holdings.find((h) => h.stock_id === 7)!.avg_buy_price, 150, "average cost survives a partial sell");
  assert.equal(r.holdings.some((h) => h.stock_id === 8), false, "fully sold, and overselling is capped");
  assert.equal(r.realized, 5 * (300 - 150) + 2 * (60 - 50));
  assert.equal(r.cash, PRACTICE_CASH - 1000 - 2000 + 1500 - 100 + 120);
  console.log("practice check: ok");
}

// Market today
import { marketDay } from "../market-day";
{
  const mk = (id: number, sector: string, cap: number, price: number, prev: number) =>
    ({ ...stock(id, sector, null, price), market_cap_cr: cap, prev_close: prev, price_date: "2026-11-23" }) as StockSnapshot;
  const m = marketDay([mk(1, "IT", 90000, 110, 100), mk(2, "IT", 10000, 90, 100), mk(3, "Bank", 50000, 95, 100), { ...mk(4, "Bank", 1000, 50, 49), price_date: "2026-11-20" }]);
  assert.equal(m.date, "2026-11-23");
  assert.equal(m.count, 3, "stale prices are left out");
  assert.equal(m.rose, 1);
  assert.equal(m.sectors[0].name, "IT");
  assert.ok(Math.abs(m.sectors[0].change - 0.08) < 1e-9, "size-weighted: (0.1*90k - 0.1*10k) / 100k");
  assert.deepEqual(m.up.map((s) => s.stock_id), [1]);
  assert.deepEqual(m.down.map((s) => s.stock_id), [3], "biggest fall first, small companies excluded");
  console.log("market check: ok");
}

// Mutual fund groups
import { groupOf } from "../funds";
{
  const g = (c: string) => groupOf(c).id;
  assert.equal(g("Other Scheme - Index Funds"), "index");
  assert.equal(g("Index Funds - Debt Funds"), "debt", "debt index funds are debt");
  assert.equal(g("Equity Scheme - Large & Mid Cap Fund"), "flexi", "not mid/small, not large");
  assert.equal(g("Equity Schemes - Large Cap Fund"), "large");
  assert.equal(g("Equity Scheme - Small Cap Fund"), "midsmall");
  assert.equal(g("Income/Debt Oriented Schemes - Liquid Fund"), "parking");
  assert.equal(g("Income/Debt Oriented Schemes - Sectoral Fund"), "debt");
  assert.equal(g("Hybrid Schemes - Arbitrage Fund"), "hybrid");
  assert.equal(g("Equity Schemes - ELSS- Tax Saver Fund"), "elss");
  assert.equal(g("Overseas Fund of Funds - Fund of Funds investing overseas"), "global");
  console.log("fund groups check: ok");
}

// Company events
import { eventSummary, upcoming as upcomingEvents } from "../events";
{
  const ev = (kind: "results" | "dividend" | "split", event_date: string, amount: number | null = null) => ({ stock_id: 1, kind, event_date, amount });
  const evs = [ev("dividend", "2025-09-01", 4), ev("dividend", "2026-02-04", 6.5), ev("dividend", "2026-05-27", 8), ev("results", "2027-01-28"), ev("split", "2024-01-01", 10)];
  const s = eventSummary(evs, "2026-11-25");
  assert.equal(s.paid12m, 14.5, "only the past 12 months");
  assert.equal(s.payments12m, 2);
  assert.equal(s.lastDividend!.event_date, "2026-05-27");
  assert.equal(s.nextResults!.event_date, "2027-01-28");
  assert.equal(upcomingEvents(evs, "2026-11-25", 30).length, 0);
  assert.equal(upcomingEvents(evs, "2026-11-25", 90).length, 1);
  console.log("events check: ok");
}

// Tax if sold today
import { taxIfSoldToday } from "../tax";
{
  const lot = (buyPrice: number, price: number, boughtOn: string | null, quantity = 100) => ({ name: "x", quantity, buyPrice, boughtOn, price });
  const t = taxIfSoldToday([lot(100, 200, "2025-01-10"), lot(100, 150, "2026-06-01"), lot(100, 50, "2026-09-01")], "2026-11-25");
  // long: +10,000 (under the 1.25 lakh exemption); short: +5,000 - 5,000 = 0
  assert.equal(t.longGain, 10000);
  assert.equal(t.shortGain, 0);
  assert.equal(t.tax, 0);
  const big = taxIfSoldToday([lot(100, 3100, "2024-01-01")], "2026-11-25"); // 3 lakh long-term
  assert.equal(Math.round(big.tax), Math.round((300000 - 125000) * 0.125 * 1.04));
  const shortLoss = taxIfSoldToday([lot(100, 3100, "2024-01-01"), lot(1000, 900, "2026-10-01", 1000)], "2026-11-25");
  assert.equal(Math.round(shortLoss.tax), Math.round((300000 - 100000 - 125000) * 0.125 * 1.04), "short loss offsets long gain");
  assert.equal(taxIfSoldToday([lot(100, 200, "2025-11-25")], "2026-11-25").longGain, 0, "exactly 12 months is still short-term");
  assert.equal(taxIfSoldToday([lot(100, 200, null)], "2026-11-25").unknownDates, 1);
  console.log("tax check: ok");
}

// P/E against its own past
import { adjustForSplits, peBand } from "../valuation";
{
  // 24 month-ends at price 100, then 12 at price 200; EPS 10 known from 2024-05-30, EPS 20 from 2025-05-30
  const months = Array.from({ length: 36 }, (_, i) => { const y = 2024 + Math.floor(i / 12); const m = (i % 12) + 1; return { date: `${y}-${String(m).padStart(2, "0")}-28`, close: i < 24 ? 100 : 200 }; });
  const b = peBand(months, [{ period_end: "2024-03-31", eps: 10 }, { period_end: "2025-03-31", eps: 20 }, { period_end: "2023-03-31", eps: -1 }])!;
  // usable from June 2024: Jun 2024-Apr 2025 at EPS 10 (P/E 10), from Jun 2025 at EPS 20 (P/E 5 then 10)
  assert.equal(b.low, 5);
  assert.equal(b.high, 10);
  assert.ok(b.months >= 12);
  assert.equal(peBand(months.slice(0, 8), [{ period_end: "2024-03-31", eps: 10 }]), null, "too little history");
  // HDFC Bank-style 1:1 bonus in Aug 2025: FY25 EPS 92.81 as filed becomes 46.41; FY26 (after the bonus) stays
  const adj = adjustForSplits([{ period_end: "2026-03-31", eps: 49.5 }, { period_end: "2025-03-31", eps: 92.81 }, { period_end: "2024-03-31", eps: null }],
    [{ event_date: "2025-08-26", amount: 2 }, { event_date: "2019-01-01", amount: 5 }]);
  assert.deepEqual(adj.map((r) => r.eps), [49.5, 46.41, null]);
  // Kotak-style: 1:5 split on 14 Jan 2026; the Dec 2025 quarter was filed after it and already reports post-split EPS
  const kotak = adjustForSplits([{ period_end: "2025-12-31", eps: 4.95, filed_on: "2026-01-24" }, { period_end: "2025-09-30", eps: 22.47, filed_on: "2025-10-25" }],
    [{ event_date: "2026-01-14", amount: 5 }]);
  assert.deepEqual(kotak.map((r) => r.eps), [4.95, 4.49]);
  console.log("valuation check: ok");
}

// index history: gauge, yearly rate, weekly thinning
import { changeOver, gauge, weekly, type IndexDay } from "../index-history";
{
  const days: IndexDay[] = Array.from({ length: 600 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1) + i * 864e5).toISOString().slice(0, 10);
    return { date: d, close: 100 + i, pe: 20 + (i % 10), pb: null, div_yield: null };
  });
  const g = gauge(days, "pe")!;
  assert.equal(g.low, 20); assert.equal(g.high, 29); assert.equal(g.now, 29);
  assert.ok(g.lowerShare > 0.85 && g.lowerShare < 0.95, "about 90% of days had a lower P/E");
  assert.equal(gauge(days, "pb"), null, "no P/B history, no gauge");
  const y1 = changeOver(days, 1)!;
  assert.ok(Math.abs(y1 - (699 / (699 - 366) - 1)) < 0.01, `1-year change ${y1}`);
  assert.equal(changeOver(days, 5), null, "not enough history for 5 years");
  const holey = days.filter((d) => d.date < "2024-03-01" || d.date > "2025-06-01");
  assert.equal(changeOver(holey, 1), null, "no price near the start date: no change shown");
  const w = weekly(days);
  assert.ok(w.length >= 85 && w.length <= 87 && w[w.length - 1] === days[days.length - 1], "one point a week, latest kept");
}
{
  const uni = [{ stock_id: 1, ticker: "JSWSTEEL.NS", name: "JSW Steel Ltd.", market_cap_cr: 1 }] as unknown as StockSnapshot[];
  const m = findMentions("JSW Steel target 2000, also buy ZZQX", uni);
  assert.deepEqual([m.found.length, m.unknown], [1, ["ZZQX"]], "JSW is part of JSW Steel, ZZQX is unknown");
}
console.log("index history: ok");

import { lastSum } from "../flows";
assert.equal(lastSum([1, 2, 3, 4], 3), 9, "sums the last n");
assert.equal(lastSum([1, 2], 3), null, "too few values");
assert.equal(lastSum([1, null, 3], 2), null, "a missing day spoils the sum");
console.log("flows: ok");
