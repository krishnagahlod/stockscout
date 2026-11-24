import { METRICS, METRIC_KEYS, formatMetric, metricValue, type MetricKey, type StockSnapshot } from "./metrics";

export type Filter = { metric: MetricKey; op: ">" | "<"; value: number };
export type RankBy = { metric: MetricKey; prefer: "high" | "low"; weight: number };

/** An investing idea as rules (stored in strategies.rules_json with version 2). */
export type IdeaRules = {
  version: 2;
  name: string;
  summary: string;
  filters: Filter[];
  sectors_include: string[];
  sectors_exclude: string[];
  rank_by: RankBy[];
  count: number;
  risks: string[];
  /** honest caveat about whether stocks suit this money at all */
  note?: string;
};

export type Pick = {
  stock: StockSnapshot;
  score: number; // 0..100, how well it fits the ranking
  reasons: string[];
};

const MAX_PER_SECTOR = 2;

/** Validate untrusted rules (from the LLM or the database); drops anything unknown. */
export function sanitizeRules(raw: unknown, sectors: string[]): IdeaRules | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const isMetric = (m: unknown): m is MetricKey => typeof m === "string" && (METRIC_KEYS as string[]).includes(m);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const sectorSet = new Set(sectors);

  const filters: Filter[] = list(r.filters).flatMap((f) => {
    const o = f as Record<string, unknown>;
    const value = num(o.value);
    return isMetric(o.metric) && (o.op === ">" || o.op === "<") && value != null ? [{ metric: o.metric, op: o.op, value }] : [];
  });
  const rank_by: RankBy[] = list(r.rank_by).flatMap((x) => {
    const o = x as Record<string, unknown>;
    const weight = num(o.weight) ?? 1;
    return isMetric(o.metric) && (o.prefer === "high" || o.prefer === "low") && weight > 0 ? [{ metric: o.metric, prefer: o.prefer, weight }] : [];
  });
  const sectorsOf = (v: unknown) => list(v).filter((s): s is string => typeof s === "string" && sectorSet.has(s));
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  if (!filters.length && !rank_by.length) return null;
  return {
    version: 2,
    name: text(r.name, 60) || "My idea",
    summary: text(r.summary, 600),
    filters,
    sectors_include: sectorsOf(r.sectors_include),
    sectors_exclude: sectorsOf(r.sectors_exclude),
    rank_by: rank_by.length ? rank_by : [{ metric: "market_cap_cr", prefer: "high", weight: 1 }],
    count: Math.min(Math.max(Math.round(num(r.count) ?? 6), 3), 12),
    risks: list(r.risks).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 200)).slice(0, 4),
    note: text(r.note, 400) || undefined,
  };
}

/** Percentile (0..1) of each stock's value among `pool` for one metric. */
function percentiles(pool: StockSnapshot[], key: MetricKey): Map<number, number> {
  const vals = pool.map((s) => [s.stock_id, metricValue(s, key)] as const).filter((x): x is readonly [number, number] => x[1] != null);
  vals.sort((a, b) => a[1] - b[1]);
  const out = new Map<number, number>();
  vals.forEach(([id], i) => out.set(id, vals.length > 1 ? i / (vals.length - 1) : 0.5));
  return out;
}

export function runRules(rules: IdeaRules, universe: StockSnapshot[]): { picks: Pick[]; matched: number } {
  const include = new Set(rules.sectors_include);
  const exclude = new Set(rules.sectors_exclude);

  const matched = universe.filter((s) => {
    if (!s.price) return false;
    if (include.size && !include.has(s.sector)) return false;
    if (exclude.has(s.sector)) return false;
    return rules.filters.every((f) => {
      const v = metricValue(s, f.metric);
      return v != null && (f.op === ">" ? v > f.value : v < f.value);
    });
  });

  const ranks = rules.rank_by.map((r) => ({ ...r, pct: percentiles(matched, r.metric) }));
  const totalWeight = ranks.reduce((a, r) => a + r.weight, 0) || 1;
  const scored = matched.map((s) => {
    // a missing value counts as the middle so it neither wins nor sinks a stock
    const fit = ranks.reduce((a, r) => {
      const p = r.pct.get(s.stock_id) ?? 0.5;
      return a + r.weight * (r.prefer === "high" ? p : 1 - p);
    }, 0) / totalWeight;
    return { stock: s, score: Math.round(fit * 100) };
  }).sort((a, b) => b.score - a.score);

  const perSector = new Map<string, number>();
  const picks: Pick[] = [];
  for (const c of scored) {
    if (picks.length >= rules.count) break;
    const n = perSector.get(c.stock.sector) ?? 0;
    if (n >= MAX_PER_SECTOR && !include.size) continue; // spread money across industries
    perSector.set(c.stock.sector, n + 1);
    picks.push({ ...c, reasons: reasonsFor(c.stock, rules, universe) });
  }
  return { picks, matched: matched.length };
}

/** Plain sentences built only from the stock's real numbers, strongest points first. */
export function reasonsFor(s: StockSnapshot, rules: IdeaRules, universe: StockSnapshot[]): string[] {
  const keys = Array.from(new Set<MetricKey>([...rules.rank_by.map((r) => r.metric), ...rules.filters.map((f) => f.metric)]));
  const scored = keys.flatMap((key) => {
    const v = metricValue(s, key);
    if (v == null) return [];
    const p = percentiles(universe, key).get(s.stock_id) ?? 0.5;
    const info = METRICS[key];
    const strength = info.better === "low" ? 1 - p : p;
    // a rank, not a judgement: "lower than 98% of the Nifty 500"
    const share = Math.min(99, Math.max(1, Math.round(strength * 100)));
    return [{ strength, text: `${info.label}: ${formatMetric(key, v)} (${info.better === "low" ? "lower" : "higher"} than ${share}% of the Nifty 500)` }];
  });
  return scored.sort((a, b) => b.strength - a.strength).slice(0, 3).map((x) => x.text);
}

export type PlanLine = { ticker: string; name: string; price: number; shares: number; cost: number };

/**
 * Split a budget across picks in whole shares: equal targets first, then spend what is left
 * one share at a time on the picks furthest below their target.
 */
export function makePlan(picks: Pick[], budget: number): { lines: PlanLine[]; leftover: number; tooExpensive: string[] } {
  const priced = picks.filter((p) => p.stock.price && p.stock.price > 0);
  if (!priced.length || budget <= 0) return { lines: [], leftover: Math.max(budget, 0), tooExpensive: [] };
  const target = budget / priced.length;
  const lines = priced.map((p) => {
    const price = p.stock.price as number;
    const shares = Math.floor(target / price);
    return { ticker: p.stock.ticker, name: p.stock.name, price, shares, cost: shares * price };
  });
  let left = budget - lines.reduce((a, l) => a + l.cost, 0);
  for (;;) {
    const next = lines.filter((l) => l.price <= left).sort((a, b) => a.cost / target - b.cost / target)[0];
    if (!next) break;
    next.shares += 1;
    next.cost += next.price;
    left -= next.price;
  }
  return {
    lines: lines.filter((l) => l.shares > 0),
    leftover: Math.round(left * 100) / 100,
    tooExpensive: lines.filter((l) => l.shares === 0).map((l) => l.ticker),
  };
}
