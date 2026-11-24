import { createClient } from "@/utils/supabase/client";

export type StockHit = { id: number; symbol: string; name: string; sector: string | null };

/** Browser-side stock search by ticker or name, biggest companies first. */
export async function searchStocks(query: string, limit = 6): Promise<StockHit[]> {
  const term = query.trim().replace(/[%,()*\\]/g, ""); // characters with meaning in PostgREST filters
  if (!term) return [];
  const { data, error } = await createClient()
    .from("stock_snapshot")
    .select("stock_id, ticker, name, sector")
    .or(`ticker.ilike.%${term}%,name.ilike.%${term}%`)
    .order("market_cap_cr", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.stock_id, symbol: s.ticker, name: s.name, sector: s.sector }));
}
