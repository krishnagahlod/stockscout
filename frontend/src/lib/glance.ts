import { yearChange, type StockSnapshot } from "./metrics";

// Facts with a comparison, never a verdict: "top 20% of the Nifty 500", not "strong business" (see docs/v2-plan.md).
export type Verdict = { label: string; tone: "good" | "ok" | "weak" | "unknown"; text: string };

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Share of `xs` strictly below `v`, from 0 to 1. */
export function rankOf(xs: number[], v: number): number {
  return xs.length ? xs.filter((x) => x < v).length / xs.length : 0;
}

/** 0.83 -> "top 15%", 0.2 -> "bottom 20%" (nearest 5, never 0). */
export function standing(r: number): string {
  const nearest5 = (x: number) => Math.max(5, Math.round(x * 20) * 5);
  return r >= 0.5 ? `top ${nearest5(1 - r)}%` : `bottom ${nearest5(r)}%`;
}

const isLender = (s: StockSnapshot) => s.sector === "Financial Services"; // banks borrow by design

function debtLine(s: StockSnapshot): string {
  const de = s.debt_to_equity;
  if (isLender(s)) return " As a lender it borrows by design, so its debt isn't compared.";
  if (de == null) return "";
  const per = `₹${de.toFixed(de < 1 ? 2 : 1)} of debt for every ₹1 of owners' money`;
  return de < 0.5 ? ` Borrows little: ${per}.` : de > 1.5 ? ` Borrows heavily: ${per}.` : ` Moderate borrowing: ${per}.`;
}

export function businessVerdict(s: StockSnapshot, universe: StockSnapshot[]): Verdict {
  const { roe, net_margin: nm } = s;
  if (roe == null) return { label: "Not enough data", tone: "unknown", text: "We don't have recent profit numbers for this company." };
  const margin = nm != null ? ` Keeps ₹${Math.round(nm * 100)} of every ₹100 of sales as profit.` : "";
  const heavyDebt = !isLender(s) && s.debt_to_equity != null && s.debt_to_equity > 1.5;
  if (roe < 0) return { label: "Made a loss", tone: "weak", text: "Lost money on its owners' capital in the latest year we have." + debtLine(s) + margin };
  const r = rankOf(universe.map((u) => u.roe).filter((x): x is number => x != null), roe);
  const tone = heavyDebt || r < 0.3 ? "weak" : r >= 0.6 ? "good" : "ok";
  return {
    label: `Profit on owners' money: ${standing(r)}`,
    tone,
    text: `Makes ${(roe * 100).toFixed(0)}% a year on its owners' money, more than ${Math.round(r * 100)}% of Nifty 500 companies.` + debtLine(s) + margin,
  };
}

export function priceVerdict(s: StockSnapshot, universe: StockSnapshot[]): Verdict {
  if (s.pe == null || s.pe <= 0) return { label: "No P/E to compare", tone: "unknown", text: "No usable price-to-profit number (the company may be making a loss)." };
  const peers = universe.filter((u) => u.sector === s.sector && u.pe != null && u.pe > 0).map((u) => u.pe as number);
  const med = median(peers);
  if (med == null || peers.length < 4) return { label: `P/E ${s.pe.toFixed(1)}`, tone: "unknown", text: `P/E is ${s.pe.toFixed(1)}, but there are too few similar companies to compare with.` };
  const ratio = s.pe / med;
  const base = `You pay ₹${s.pe.toFixed(0)} for every ₹1 of yearly profit; similar companies average ₹${med.toFixed(0)}.`;
  if (ratio < 0.8) return { label: "P/E below similar companies", tone: "good", text: base + " A lower P/E can mean a bargain, or that investors expect trouble." };
  if (ratio > 1.25) return { label: "P/E above similar companies", tone: "weak", text: base + " Investors expect faster growth; if it doesn't come, the price can fall." };
  return { label: "P/E close to similar companies", tone: "ok", text: base };
}

export function trendVerdict(s: StockSnapshot): Verdict {
  const y = yearChange(s);
  const vol = s.volatility_30d;
  if (y == null) return { label: "Not enough history", tone: "unknown", text: "Less than a year of prices." };
  const label = `${y >= 0 ? "Up" : "Down"} ${Math.abs(y * 100).toFixed(0)}% in 1 year`;
  const swings = vol == null ? "" : vol < 0.25 ? "The price has been calm lately." : vol > 0.4 ? "The price has been jumping around a lot lately." : "Normal ups and downs lately.";
  const tone = y > 0.1 ? "good" : y < -0.15 ? "weak" : "ok";
  return { label, tone, text: swings };
}

/** One plain line from the numbers, e.g. "Profitable, borrows little and its P/E is close to its own 5-year middle." */
export function stockGlance(s: StockSnapshot, band: { pos: "below" | "above" | "close to"; years: number } | null): string | null {
  const parts: string[] = [];
  if (s.roe != null) parts.push(s.roe < 0 || (s.net_margin ?? 0) < 0 ? "Made a loss in its latest year" : "Profitable");
  const de = s.debt_to_equity;
  if (!isLender(s) && de != null) parts.push(de < 0.5 ? "borrows little" : de > 1.5 ? "borrows heavily" : "borrows a moderate amount");
  if (band) parts.push(`its P/E is ${band.pos} its own ${band.years}-year middle`);
  if (!parts.length) return null;
  const line = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return line[0].toUpperCase() + line.slice(1) + ".";
}
