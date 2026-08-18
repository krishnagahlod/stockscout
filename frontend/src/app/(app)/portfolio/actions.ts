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
      acquired_date: new Date().toISOString().split('T')[0]
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
  
  // Track prices to insert into daily_prices
  const priceUpdates: { stock_id: number; price: number }[] = [];

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
      if (h.currentPrice) {
        priceUpdates.push({ stock_id: stockId, price: h.currentPrice });
      }
    } else {
      unmatchedHoldings.push(h);
    }
  }

  const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
  const apiKey = process.env.FASTAPI_SECRET || "dev_shared_secret_key";

  // Create custom stocks for unmatched holdings
  if (unmatchedHoldings.length > 0) {
    try {
      const names = unmatchedHoldings.map(h => h.assetIdentifier.trim());
      
      const res = await fetch(`${backendUrl}/api/portfolio/add-custom-stocks`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({ names }),
      });
      
      if (res.ok) {
        const { stocks: customStocks } = await res.json();
        for (const h of unmatchedHoldings) {
          const stockId = customStocks[h.assetIdentifier.trim()];
          if (stockId) {
            recordsToInsert.push({
              user_id: user.id,
              stock_id: stockId,
              quantity: h.quantity,
              avg_buy_price: h.avgBuyPrice,
              acquired_date: currentDate
            });
            if (h.currentPrice) {
              priceUpdates.push({ stock_id: stockId, price: h.currentPrice });
            }
          }
        }
      } else {
        console.error("Failed to create custom stocks:", await res.text());
      }
    } catch (e) {
      console.error("Error communicating with backend to create custom stocks:", e);
    }
  }

  if (recordsToInsert.length === 0) {
    return { success: false, message: "Could not match any of the imported stocks to our database." };
  }

  // Send prices to backend to update daily_prices
  if (priceUpdates.length > 0) {
    try {
      const res = await fetch(`${backendUrl}/api/portfolio/update-csv-prices`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({ prices: priceUpdates }),
      });
      if (!res.ok) {
        console.error("Failed to update CSV prices:", await res.text());
      }
    } catch (e) {
      console.error("Error communicating with backend to update CSV prices:", e);
    }
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
  return { success: true, count: recordsToInsert.length };
}
