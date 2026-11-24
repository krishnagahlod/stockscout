import type { IdeaRules } from "./rules";

/** Ready-made ideas that work without the AI, written for first-time investors. */
export const STARTER_IDEAS: (IdeaRules & { slug: string; emoji: string; tagline: string })[] = [
  {
    version: 2, slug: "steady-giants", emoji: "🏛️",
    name: "Steady big companies",
    tagline: "Large, profitable companies that don't swing wildly",
    summary: "Big, well-known companies that make solid profits, don't borrow too much, and whose prices move calmly. A sensible first step for long-term money.",
    filters: [
      { metric: "market_cap_cr", op: ">", value: 50000 },
      { metric: "roe", op: ">", value: 0.12 },
    ],
    sectors_include: [], sectors_exclude: [],
    rank_by: [
      { metric: "volatility_30d", prefer: "low", weight: 1 },
      { metric: "roe", prefer: "high", weight: 1 },
    ],
    count: 6,
    risks: ["Big companies can still fall 20–30% in a bad year.", "Calm prices also mean slower growth than smaller companies in good years."],
  },
  {
    version: 2, slug: "pays-you-back", emoji: "💸",
    name: "Companies that pay you",
    tagline: "Regular dividends from established businesses",
    summary: "Companies that share a good part of their profits as cash (dividends) and are big enough to keep doing it.",
    filters: [
      { metric: "dividend_yield", op: ">", value: 0.02 },
      { metric: "market_cap_cr", op: ">", value: 10000 },
      { metric: "roe", op: ">", value: 0.1 },
    ],
    sectors_include: [], sectors_exclude: [],
    rank_by: [
      { metric: "dividend_yield", prefer: "high", weight: 2 },
      { metric: "debt_to_equity", prefer: "low", weight: 1 },
    ],
    count: 6,
    risks: ["Dividends can be cut when profits fall.", "A very high dividend yield sometimes means the price has crashed."],
  },
  {
    version: 2, slug: "quality-fair-price", emoji: "⚖️",
    name: "Good business, fair price",
    tagline: "Strong profits without paying too much",
    summary: "Companies that earn well on their owners' money, carry little debt, and aren't priced at extreme levels compared with their profits.",
    filters: [
      { metric: "roe", op: ">", value: 0.15 },
      { metric: "pe", op: "<", value: 35 },
      { metric: "debt_to_equity", op: "<", value: 0.6 },
    ],
    sectors_include: [], sectors_exclude: [],
    rank_by: [
      { metric: "roe", prefer: "high", weight: 1 },
      { metric: "pe", prefer: "low", weight: 1 },
    ],
    count: 6,
    risks: ["A cheap-looking price can stay cheap for years.", "Past profits don't guarantee future ones."],
  },
  {
    version: 2, slug: "low-drama", emoji: "🧘",
    name: "Low debt, low drama",
    tagline: "Hardly any borrowing and calm prices",
    summary: "Companies with very little debt and smaller price swings, for people who'd rather sleep well than chase big gains.",
    filters: [
      { metric: "debt_to_equity", op: "<", value: 0.3 },
      { metric: "market_cap_cr", op: ">", value: 5000 },
    ],
    sectors_include: [], sectors_exclude: [],
    rank_by: [
      { metric: "volatility_30d", prefer: "low", weight: 2 },
      { metric: "max_drawdown_1y", prefer: "high", weight: 1 },
    ],
    count: 6,
    risks: ["Calm stocks can still drop with the whole market.", "Low-debt companies sometimes grow slowly."],
  },
  {
    version: 2, slug: "riding-the-trend", emoji: "🚀",
    name: "Riding the trend",
    tagline: "Stocks that have been rising strongly (higher risk)",
    summary: "Companies whose share price has risen the most over the past year, with a basic profit check. Exciting, but the riskiest idea here.",
    filters: [
      { metric: "momentum_12m", op: ">", value: 0.1 },
      { metric: "roe", op: ">", value: 0.08 },
    ],
    sectors_include: [], sectors_exclude: [],
    rank_by: [{ metric: "momentum_12m", prefer: "high", weight: 1 }],
    count: 6,
    risks: ["Trends can reverse suddenly; these can fall fast.", "Only put in money you won't need for several years."],
  },
];
