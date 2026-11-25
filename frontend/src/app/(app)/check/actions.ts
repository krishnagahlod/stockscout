"use server";

import { createClient } from "@/utils/supabase/server";
import { getPriceHistory, getUniverse } from "@/lib/market";
import { findMentions, hypeWords, tipFlags, type Flag } from "@/lib/tips";
import { shortTicker } from "@/lib/format";

export type CheckedCompany = {
  ticker: string; name: string; sector: string; price: number | null; priceDate: string | null; marketCap: number | null;
  flags: Flag[]; fine: string[];
};
export type CheckState = { hype?: string[]; companies?: CheckedCompany[]; unknown?: string[]; more?: number; error?: string; checked?: boolean };

const MAX_COMPANIES = 3;

export async function checkTip(_prev: CheckState, formData: FormData): Promise<CheckState> {
  const text = String(formData.get("text") ?? "").trim().slice(0, 3000);
  if (text.length < 2) return { error: "Paste the message, or type a company name." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session ended. Sign in again to check a tip." };

  const universe = await getUniverse();
  const { found, unknown } = findMentions(text, universe);
  const companies = await Promise.all(
    found.slice(0, MAX_COMPANIES).map(async (s) => {
      const history = await getPriceHistory(s.stock_id, 1);
      const { flags, fine } = tipFlags(s, universe, history);
      return {
        ticker: shortTicker(s.ticker), name: s.name, sector: s.sector, price: s.price, priceDate: s.price_date,
        marketCap: s.market_cap_cr, flags, fine,
      };
    }),
  );
  return { checked: true, hype: hypeWords(text), companies, unknown: unknown.slice(0, 5), more: Math.max(0, found.length - MAX_COMPANIES) };
}
