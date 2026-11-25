"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function addHolding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const ticker = formData.get("ticker") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const avgBuyPrice = parseFloat(formData.get("avgBuyPrice") as string);
  const today = new Date().toISOString().split("T")[0];
  const boughtOn = String(formData.get("boughtOn") ?? "");
  // a real past date in ISO form, else today
  const acquired = /^\d{4}-\d{2}-\d{2}$/.test(boughtOn) && boughtOn <= today && boughtOn >= "1990-01-01" ? boughtOn : today;

  if (!ticker || isNaN(quantity) || isNaN(avgBuyPrice)) {
    throw new Error("Invalid input");
  }

  // Find stock ID
  const { data: stock, error: stockError } = await supabase
    .from("stocks")
    .select("id")
    .eq("ticker", ticker.toUpperCase())
    .single();

  if (stockError || !stock) {
    throw new Error(`Stock ${ticker} not found in database.`);
  }

  // Insert holding
  const { error: insertError } = await supabase
    .from("holdings")
    .insert({
      user_id: user.id,
      stock_id: stock.id,
      quantity,
      avg_buy_price: avgBuyPrice,
      acquired_date: acquired
    });

  if (insertError) {
    console.error("Error adding holding:", insertError);
    throw new Error("Failed to add holding");
  }

  revalidatePath("/portfolio");
  return { success: true };
}

export async function importHoldings(holdings: { assetIdentifier: string; quantity: number; avgBuyPrice: number; currentPrice?: number }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Fetch all available stocks to build a lookup map
  // This is efficient enough for 500-1000 stocks
  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("id, ticker, name");

  if (stocksError || !stocks) {
    throw new Error("Failed to load stocks from database");
  }

  // Build lookup maps for fast matching
  const tickerMap = new Map<string, number>();
  const nameMap = new Map<string, number>();
  
  stocks.forEach(s => {
    tickerMap.set(s.ticker.toUpperCase(), s.id);
    if (s.name) {
      nameMap.set(s.name.toLowerCase().trim(), s.id);
    }
  });

  const recordsToInsert = [];
  const currentDate = new Date().toISOString().split('T')[0];
  const unmatchedHoldings = [];
  

  for (const h of holdings) {
    let stockId = undefined;
    const identifier = h.assetIdentifier.trim();
    const upperId = identifier.toUpperCase();
    const lowerId = identifier.toLowerCase();
    
    // 1. Try exact ticker match
    stockId = tickerMap.get(upperId);
    
    // 2. Try exact ticker match with .NS appended
    if (!stockId && !upperId.includes('.')) {
      stockId = tickerMap.get(`${upperId}.NS`);
    }

    // 3. Try exact name match
    if (!stockId) {
      stockId = nameMap.get(lowerId);
    }

    // 4. Try partial name match (e.g. "State Bank of India" vs "State Bank")
    if (!stockId) {
      for (const [stockName, id] of nameMap.entries()) {
        if (stockName.includes(lowerId) || lowerId.includes(stockName)) {
          stockId = id;
          break;
        }
      }
    }

    if (stockId) {
      recordsToInsert.push({
        user_id: user.id,
        stock_id: stockId,
        quantity: h.quantity,
        avg_buy_price: h.avgBuyPrice,
        acquired_date: currentDate
      });
    } else {
      unmatchedHoldings.push(h);
    }
  }

  if (recordsToInsert.length === 0) {
    return { success: false, message: "None of the rows matched a Nifty 500 company we track, so nothing was changed." };
  }

  // Delete existing holdings for this user before importing (to keep it a clean sync)
  await supabase.from("holdings").delete().eq("user_id", user.id);

  const { error: insertError } = await supabase
    .from("holdings")
    .insert(recordsToInsert);

  if (insertError) {
    console.error("Error bulk importing holdings:", insertError);
    throw new Error("Failed to import holdings");
  }

  revalidatePath("/portfolio");
  const skipped = unmatchedHoldings.map((h) => h.assetIdentifier.trim()).slice(0, 10);
  return { success: true, count: recordsToInsert.length, skipped };
}

export async function deleteHolding(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase.from("holdings").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error("Failed to delete holding");
  revalidatePath("/portfolio");
  revalidatePath("/home");
}
