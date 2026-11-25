"use server";

import { createClient } from "@/utils/supabase/server";
import { getPriceHistory, getUniverse } from "@/lib/market";
import { findMentions, hypeWords, tipFlags, type Flag } from "@/lib/tips";
import { shortTicker } from "@/lib/format";
import { aiAvailable, askJson, factsOnly } from "@/lib/llm";

export type CheckedCompany = {
  ticker: string; name: string; sector: string; price: number | null; priceDate: string | null; marketCap: number | null;
  flags: Flag[]; fine: string[];
};
export type CheckState = { hype?: string[]; companies?: CheckedCompany[]; unknown?: string[]; more?: number; error?: string; checked?: boolean; summary?: string };

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
      const [history, { data: own }] = await Promise.all([
        getPriceHistory(s.stock_id, 1),
        supabase.from("stock_ownership").select("pledged").eq("stock_id", s.stock_id).eq("source", "nse").order("as_of", { ascending: false }).limit(1),
      ]);
      const pledged = own?.[0]?.pledged;
      const { flags, fine } = tipFlags(s, universe, history, pledged == null ? null : Number(pledged));
      return {
        ticker: shortTicker(s.ticker), name: s.name, sector: s.sector, price: s.price, priceDate: s.price_date,
        marketCap: s.market_cap_cr, flags, fine,
      };
    }),
  );
  const result: CheckState = { checked: true, hype: hypeWords(text), companies, unknown: unknown.slice(0, 5), more: Math.max(0, found.length - MAX_COMPANIES) };
  result.summary = await summarize(result);
  return result;
}

const SUMMARY_SYSTEM = `Someone pasted a stock tip into a checker. You get the checker's findings (not the message).
Sum them up for a student in at most 2 short, plain sentences: what stands out most, and the one thing to check before acting.
Use only the findings given. If you repeat the message's own words, put them in double quotes. Never tell them to buy, sell or hold, never give a price target, never predict the price.
Reply as JSON: {"lines": ["...", "..."]}`;

/** Two plain sentences from the findings, or undefined when AI is off, slow or says something that reads like a call. */
async function summarize(r: CheckState): Promise<string | undefined> {
  if (!aiAvailable() || (!r.companies?.length && !r.hype?.length && !r.unknown?.length)) return undefined;
  const findings = [
    r.hype?.length ? `Hype phrases in the message: ${r.hype.join(", ")}.` : "No hype phrases in the message.",
    ...(r.unknown?.length ? [`Names outside the Nifty 500 (no data): ${r.unknown.join(", ")}.`] : []),
    ...(r.companies ?? []).map((c) => `${c.name} (${c.sector}). Red flags: ${c.flags.filter((f) => f.level === "red").map((f) => f.text).join(" ") || "none"}. To watch: ${c.flags.filter((f) => f.level === "amber").map((f) => f.text).join(" ") || "none"}. Fine: ${c.fine.join(" ") || "nothing noted"}.`),
  ].join("\n");
  try {
    const raw = await askJson<{ lines?: unknown }>([{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: findings }], { timeoutMs: 15_000 });
    const lines = factsOnly(raw?.lines, 2);
    if (!lines) console.error("tip summary dropped:", JSON.stringify(raw).slice(0, 300));
    return lines?.join(" ");
  } catch (e) {
    console.error(`tip summary: ${(e as Error).message}`);
    return undefined;
  }
}
