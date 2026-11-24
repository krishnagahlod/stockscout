// One place that says what every number means, in plain words.
// Values follow the database: ratios as decimals (0.15 = 15%), market cap in crores.

export type StockSnapshot = {
  stock_id: number;
  ticker: string;
  name: string;
  sector: string;
  industry: string | null;
  is_index_member: boolean | null;
  market_cap_cr: number | null;
  price_date: string | null;
  price: number | null;
  prev_close: number | null;
  close_1y_ago: number | null;
  fundamentals_date: string | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  dividend_yield: number | null;
  eps: number | null;
  net_margin: number | null;
  operating_margin: number | null;
  beta: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  technicals_date: string | null;
  rsi_14: number | null;
  sma_200: number | null;
  volatility_30d: number | null;
  max_drawdown_1y: number | null;
  momentum_12m: number | null;
};

export type MetricKey =
  | "market_cap_cr" | "pe" | "pb" | "roe" | "debt_to_equity" | "dividend_yield"
  | "net_margin" | "momentum_12m" | "volatility_30d" | "max_drawdown_1y" | "rsi_14" | "beta";

export type MetricInfo = {
  label: string;
  short: string;
  explain: string;
  unit: "pct" | "ratio" | "crore" | "number";
  /** which direction a cautious beginner would usually prefer */
  better: "high" | "low" | "neither";
};

export const METRICS: Record<MetricKey, MetricInfo> = {
  market_cap_cr: { label: "Company size", short: "Market cap", unit: "crore", better: "high",
    explain: "The total value of the company on the stock market. Bigger companies are usually steadier." },
  pe: { label: "Price vs profit", short: "P/E", unit: "number", better: "low",
    explain: "How many rupees you pay for every ₹1 the company earns in a year. Lower can mean cheaper, but very low can also mean trouble." },
  pb: { label: "Price vs assets", short: "P/B", unit: "number", better: "low",
    explain: "Share price compared with what the company owns minus what it owes. Below 3 is usually seen as reasonable." },
  roe: { label: "Profit on owners' money", short: "ROE", unit: "pct", better: "high",
    explain: "How much profit the company makes each year on the money its shareholders put in. Above 15% is strong." },
  debt_to_equity: { label: "Borrowing", short: "Debt / equity", unit: "ratio", better: "low",
    explain: "How much the company has borrowed compared with its own money. Below 0.5 is low; above 1.5 is heavy (banks are normally higher)." },
  dividend_yield: { label: "Cash paid to you", short: "Dividend yield", unit: "pct", better: "high",
    explain: "Cash the company pays shareholders each year, as a share of today's price. 2% means ₹2 a year for every ₹100 invested." },
  net_margin: { label: "Profit margin", short: "Net margin", unit: "pct", better: "high",
    explain: "Out of every ₹100 of sales, how much is left as profit." },
  momentum_12m: { label: "1-year price change", short: "12m change", unit: "pct", better: "high",
    explain: "How much the share price moved over the last year. Past moves don't promise future ones." },
  volatility_30d: { label: "Price swings", short: "Volatility", unit: "pct", better: "low",
    explain: "How bumpy the price has been recently, scaled to a year. Under 25% is calm; over 40% is a rough ride." },
  max_drawdown_1y: { label: "Worst fall in a year", short: "Max drawdown", unit: "pct", better: "high",
    explain: "The biggest drop from a high point during the last year. −20% means it fell a fifth before recovering (or not)." },
  rsi_14: { label: "Recent buying pressure", short: "RSI", unit: "number", better: "neither",
    explain: "A 0–100 gauge of the last two weeks. Above 70: it rose fast recently. Below 30: it fell fast." },
  beta: { label: "Moves with the market", short: "Beta", unit: "number", better: "neither",
    explain: "1 means it tends to move like the market. Below 1 is calmer than the market, above 1 is jumpier." },
};

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export function metricValue(s: StockSnapshot, key: MetricKey): number | null {
  const v = s[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function formatMetric(key: MetricKey, v: number | null): string {
  if (v == null) return "—";
  switch (METRICS[key].unit) {
    case "pct": return `${(v * 100).toFixed(1)}%`;
    case "crore": return v >= 100_000 ? `₹${(v / 100_000).toFixed(1)} L Cr` : `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
    case "ratio": return v.toFixed(2);
    default: return v.toFixed(1);
  }
}

export function dayChange(s: StockSnapshot): number | null {
  return s.price && s.prev_close ? s.price / s.prev_close - 1 : null;
}

export function yearChange(s: StockSnapshot): number | null {
  return s.price && s.close_1y_ago ? s.price / s.close_1y_ago - 1 : s.momentum_12m;
}
