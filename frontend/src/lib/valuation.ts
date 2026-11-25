// A company's P/E against its own past: monthly price over the latest published yearly EPS.
import type { Point } from "./risk";

export type AnnualEps = { period_end: string; eps: number | null };

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** P/E range over the price history (one point per month), using EPS once ~60 days after the year ends. */
export function peBand(prices: Point[], annual: AnnualEps[]) {
  const eps = annual.filter((a) => a.eps != null && a.eps > 0).map((a) => ({ known: addDays(a.period_end, 60), eps: a.eps as number })).sort((a, b) => a.known.localeCompare(b.known));
  if (!eps.length) return null;
  const monthEnds = prices.filter((p, i) => i === prices.length - 1 || prices[i + 1].date.slice(0, 7) !== p.date.slice(0, 7));
  const pes: number[] = [];
  for (const p of monthEnds) {
    const e = eps.filter((x) => x.known <= p.date).pop();
    if (e) pes.push(p.close / e.eps);
  }
  if (pes.length < 12) return null; // under a year of comparable months is too little to call a range
  return { low: Math.min(...pes), mid: median(pes), high: Math.max(...pes), months: pes.length };
}
