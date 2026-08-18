import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PortfolioDashboard } from "./portfolio-dashboard";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch broker accounts
  const { data: brokerAccounts } = await supabase
    .from("broker_accounts")
    .select("id, broker_name, account_label, account_purpose")
    .eq("user_id", user.id);

  // Fetch holdings with stock details
  const { data: holdings } = await supabase
    .from("holdings")
    .select(`
      id,
      quantity,
      avg_buy_price,
      acquired_date,
      source,
      broker_account_id,
      stocks (
        id,
        ticker,
        name,
        industry
      )
    `)
    .eq("user_id", user.id);

  // Fetch current prices from daily_prices
  const stockIds = holdings?.map(h => (h.stocks as any).id) || [];
  let currentPrices: Record<string, number> = {};
  
  if (stockIds.length > 0) {
    const { data: prices } = await supabase
      .from("daily_prices")
      .select("stock_id, close")
      .in("stock_id", stockIds)
      .order("date", { ascending: false });
      
    if (prices) {
      prices.forEach(p => {
        if (!currentPrices[p.stock_id]) {
          currentPrices[p.stock_id] = p.close;
        }
      });
    }
  }

  // Calculate portfolio metrics & sector distribution
  let totalInvested = 0;
  let currentValue = 0;
  const sectorAllocation: Record<string, number> = {};

  const enrichedHoldings = (holdings || []).map(h => {
    const stock = h.stocks as any;
    const currentPrice = currentPrices[stock.id] || h.avg_buy_price;
    const invested = h.quantity * h.avg_buy_price;
    const current = h.quantity * currentPrice;
    const pnl = current - invested;
    const pnlPct = (pnl / invested) * 100;
    
    totalInvested += invested;
    currentValue += current;
    
    const sector = stock.industry || "Other";
    sectorAllocation[sector] = (sectorAllocation[sector] || 0) + current;
    
    return {
      ...h,
      stock,
      currentPrice,
      invested,
      current,
      pnl,
      pnlPct
    };
  });

  const totalPnl = currentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const pieData = Object.keys(sectorAllocation)
    .map(sector => ({
      name: sector,
      value: sectorAllocation[sector]
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <PortfolioDashboard
      userId={user.id}
      totalInvested={totalInvested}
      currentValue={currentValue}
      totalPnl={totalPnl}
      totalPnlPct={totalPnlPct}
      enrichedHoldings={enrichedHoldings}
      pieData={pieData}
      brokerAccounts={brokerAccounts || []}
    />
  );
}
