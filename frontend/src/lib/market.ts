// Server-side reads of market data. Universe and price history are the same for everyone, so they use a
// cookie-less anon client and Next's data cache: one Supabase read per hour instead of one per page view.
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { StockSnapshot } from "./metrics";

const HOUR = 3600;
export const publicDb = () =>
  createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export const getUniverse = unstable_cache(async (): Promise<StockSnapshot[]> => {
  const supabase = publicDb();
  // the Nifty 500 only (~500 rows, under PostgREST's 1000-row page); ETFs, the index and CSV-imported custom rows are excluded
  const { data, error } = await supabase.from("stock_snapshot").select("*").eq("is_index_member", true).not("price", "is", null);
  if (error) throw new Error(`Could not load market data: ${error.message}`);
  return (data ?? []) as StockSnapshot[];
}, ["universe"], { revalidate: HOUR });

export async function getSnapshots(supabase: SupabaseClient, stockIds: number[]): Promise<Map<number, StockSnapshot>> {
  if (!stockIds.length) return new Map();
  const { data, error } = await supabase.from("stock_snapshot").select("*").in("stock_id", stockIds);
  if (error) throw new Error(`Could not load prices: ${error.message}`);
  return new Map((data ?? []).map((s) => [s.stock_id, s as StockSnapshot]));
}

export async function getByTicker(supabase: SupabaseClient, ticker: string): Promise<StockSnapshot | null> {
  const t = ticker.toUpperCase();
  const candidates = t.includes(".") ? [t] : [`${t}.NS`, `${t}.BO`, t];
  const { data } = await supabase.from("stock_snapshot").select("*").in("ticker", candidates).limit(1);
  return (data?.[0] as StockSnapshot) ?? null;
}

export type PricePoint = { date: string; open: number; high: number; low: number; close: number; volume: number | null; delivery_pct?: number | null };

/** Daily closes for the last `years`, newest last. Pages through PostgREST's 1000-row limit. */
export const getPriceHistory = unstable_cache(async (stockId: number, years: number = 5): Promise<PricePoint[]> => {
  const supabase = publicDb();
  const since = new Date();
  since.setFullYear(since.getFullYear() - years);
  const out: PricePoint[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabase
      .from("daily_prices")
      .select("date, open, high, low, close, volume, delivery_pct")
      .eq("stock_id", stockId)
      .gte("date", since.toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as PricePoint[]).filter((p) => Number.isFinite(p.close) && p.close > 0));
    if (data.length < 1000) break;
  }
  return out;
}, ["price-history"], { revalidate: HOUR });

export function dataAsOf(universe: StockSnapshot[]): string | null {
  return universe.reduce<string | null>((a, s) => (s.price_date && (!a || s.price_date > a) ? s.price_date : a), null);
}
