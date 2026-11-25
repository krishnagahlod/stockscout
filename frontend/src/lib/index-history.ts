// NSE index history (close, P/E, P/B, dividend yield) from market_daily, filled nightly from NSE's index file.
import { unstable_cache } from "next/cache";
import { publicDb } from "./market";
import { rankOf } from "./glance";

export type IndexDay = { date: string; close: number; pe: number | null; pb: number | null; div_yield: number | null };

/** Index names as stored (lower-case NSE names) with the label we show. */
export const BROAD_INDICES = [
  { id: "nifty 50", label: "Nifty 50", note: "India's 50 largest companies" },
  { id: "nifty next 50", label: "Nifty Next 50", note: "the next 50 by size" },
  { id: "nifty midcap 150", label: "Nifty Midcap 150", note: "mid-sized companies" },
  { id: "nifty smallcap 250", label: "Nifty Smallcap 250", note: "small companies" },
  { id: "nifty 500", label: "Nifty 500", note: "the 500 largest, about 90% of the market" },
] as const;

export const getIndexHistory = unstable_cache(async (name: string, years: number = 11): Promise<IndexDay[]> => {
  const since = new Date();
  since.setFullYear(since.getFullYear() - years);
  const db = publicDb();
  const out: IndexDay[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await db.from("market_daily").select("date, close, pe, pb, div_yield")
      .eq("index_name", name).gte("date", since.toISOString().slice(0, 10)).order("date").range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as IndexDay[]));
    if (data.length < 1000) break;
  }
  return out;
}, ["index-history"], { revalidate: 3600 });

export type Gauge = { now: number; low: number; high: number; median: number; lowerShare: number; since: string };

/** Today's value against every earlier day: range, median and the share of days that were lower. */
export function gauge(days: IndexDay[], key: "pe" | "pb" | "div_yield" | "close"): Gauge | null {
  const pts = days.filter((d) => d[key] != null && (d[key] as number) > 0);
  if (pts.length < 250) return null; // under about a year of history says little
  const vals = pts.map((d) => d[key] as number);
  const now = vals[vals.length - 1];
  const sorted = [...vals].sort((a, b) => a - b);
  return { now, low: sorted[0], high: sorted[sorted.length - 1], median: sorted[Math.floor(sorted.length / 2)], lowerShare: rankOf(vals, now), since: pts[0].date };
}

/** Change from the last close on or before `years` ago; over a year it is a yearly rate. */
export function changeOver(days: IndexDay[], years: number): number | null {
  const last = days[days.length - 1];
  if (!last) return null;
  const d = new Date(`${last.date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - Math.round(years * 12));
  const cut = d.toISOString().slice(0, 10);
  const start = days.findLast((p) => p.date <= cut);
  // a start more than 10 days before the cut means a hole in the history, not a real starting price
  if (!start || Date.parse(cut) - Date.parse(start.date) > 10 * 864e5) return null;
  const total = last.close / start.close;
  return years > 1 ? total ** (1 / years) - 1 : total - 1;
}

/** One point a week (the last trading day of each week), enough for a 10-year line. */
export function weekly(days: IndexDay[]): IndexDay[] {
  const out: IndexDay[] = [];
  for (const d of days) {
    const wk = Math.floor(Date.parse(d.date) / (7 * 864e5));
    if (out.length && Math.floor(Date.parse(out[out.length - 1].date) / (7 * 864e5)) === wk) out[out.length - 1] = d;
    else out.push(d);
  }
  return out;
}
