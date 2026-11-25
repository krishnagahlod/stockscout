// Institutional money flows: daily FII/DII net buying (NSE, from 25 Nov 2026) and monthly FPI equity investment (NSDL).
import { unstable_cache } from "next/cache";
import { publicDb } from "./market";

export type FlowDay = { date: string; fii: number | null; dii: number | null };
export type FpiMonth = { month: string; equity: number };

export const getFlows = unstable_cache(async (): Promise<{ days: FlowDay[]; months: FpiMonth[] }> => {
  const db = publicDb();
  const [{ data: d }, { data: m }] = await Promise.all([
    db.from("fund_flows").select("date, category, net").order("date", { ascending: false }).limit(120),
    db.from("fpi_monthly").select("month, equity").gte("month", "2016-01-01").order("month"),
  ]);
  const byDate = new Map<string, FlowDay>();
  for (const r of (d ?? []) as { date: string; category: "fii" | "dii"; net: number }[]) {
    const day = byDate.get(r.date) ?? { date: r.date, fii: null, dii: null };
    day[r.category] = r.net;
    byDate.set(r.date, day);
  }
  return { days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), months: (m ?? []) as FpiMonth[] };
}, ["flows"], { revalidate: 3600 });

/** Sum of the last `n` values, or null when there are fewer than `n`. */
export function lastSum(values: (number | null)[], n: number): number | null {
  const tail = values.slice(-n);
  return tail.length === n && tail.every((v) => v != null) ? tail.reduce<number>((a, v) => a + (v as number), 0) : null;
}
