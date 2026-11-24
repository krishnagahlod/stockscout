"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getByTicker } from "@/lib/market";
import { replay, type Trade } from "@/lib/practice";
import { rupees, shortTicker } from "@/lib/format";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return { supabase, user };
}

async function currentBook(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.from("practice_trades").select("id, stock_id, quantity, price, traded_at").eq("user_id", userId);
  if (error) throw new Error(`Could not load practice trades: ${error.message}`);
  return replay((data ?? []) as Trade[]);
}

export type TradeResult = { ok?: string; error?: string };

/** Buy or sell at the latest close we have. The price always comes from our data, never from the browser. */
export async function practiceTrade(_prev: TradeResult, formData: FormData): Promise<TradeResult> {
  const ticker = String(formData.get("ticker") ?? "").trim();
  const side = formData.get("side") === "sell" ? "sell" : "buy";
  const qty = Math.floor(Number(formData.get("quantity")));
  if (!ticker) return { error: "Pick a company or fund first." };
  if (!Number.isFinite(qty) || qty < 1 || qty > 1_000_000) return { error: "Enter a whole number of shares, 1 or more." };

  const { supabase, user } = await requireUser();
  const stock = await getByTicker(supabase, ticker);
  if (!stock?.price) return { error: "We don't have a recent price for that one." };
  if (stock.sector === "Index") return { error: "An index can't be bought directly. Try a Nifty 50 ETF instead." };

  const book = await currentBook(supabase, user.id);
  if (side === "buy" && qty * stock.price > book.cash + 0.005) {
    return { error: `That costs ${rupees(qty * stock.price)}, but you have ${rupees(book.cash)} of practice cash left.` };
  }
  const held = book.holdings.find((h) => h.stock_id === stock.stock_id)?.quantity ?? 0;
  if (side === "sell" && qty > held) return { error: `You hold ${held} of these, so you can sell at most ${held}.` };

  const { error } = await supabase.from("practice_trades").insert({ user_id: user.id, stock_id: stock.stock_id, quantity: side === "buy" ? qty : -qty, price: stock.price });
  if (error) return { error: "Couldn't save that trade. Try again." };
  revalidatePath("/practice");
  return { ok: `${side === "buy" ? "Bought" : "Sold"} ${qty} ${shortTicker(stock.ticker)} at ${rupees(stock.price, true)} (pretend money).` };
}

/** From the ideas split calculator: buy every line with practice money, all or nothing. */
export async function practiceBuyMany(lines: { ticker: string; shares: number }[]): Promise<{ added?: number; error?: string }> {
  const { supabase, user } = await requireUser();
  const wanted = lines.filter((l) => Number.isInteger(l.shares) && l.shares > 0).slice(0, 20);
  if (!wanted.length) return { error: "Nothing to buy." };
  const stocks = await Promise.all(wanted.map((l) => getByTicker(supabase, l.ticker)));
  const rows = wanted.flatMap((l, i) => (stocks[i]?.price ? [{ user_id: user.id, stock_id: stocks[i]!.stock_id, quantity: l.shares, price: stocks[i]!.price! }] : []));
  if (rows.length !== wanted.length) return { error: "Some prices are missing. Try again tomorrow." };
  const cost = rows.reduce((a, r) => a + r.quantity * r.price, 0);
  const { cash } = await currentBook(supabase, user.id);
  if (cost > cash + 0.005) return { error: `That costs ${rupees(cost)}, but you have ${rupees(cash)} of practice cash left.` };
  const { error } = await supabase.from("practice_trades").insert(rows);
  if (error) return { error: "Couldn't save those trades. Try again." };
  revalidatePath("/practice");
  return { added: rows.length };
}

export async function resetPractice(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("practice_trades").delete().eq("user_id", user.id);
  revalidatePath("/practice");
}
