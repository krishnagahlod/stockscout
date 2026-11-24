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
  console.log("portfolio check: ok");
}
