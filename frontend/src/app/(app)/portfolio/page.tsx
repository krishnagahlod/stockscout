import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PortfolioDashboard } from "./portfolio-dashboard";

export default async function PortfolioPage() {
  let user: any = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (err) {
    console.error("Error fetching user in PortfolioPage:", err);
  }

  const userId = user?.id || "demo-user";
  let brokerAccounts: any[] = [];
  let holdings: any[] = [];
  let currentPrices: Record<string, number> = {};

  if (user) {
    try {
      const supabase = await createClient();
      const { data: accounts } = await supabase
        .from("broker_accounts")
        .select("id, broker_name, account_label, account_purpose")
        .eq("user_id", user.id);
      brokerAccounts = accounts || [];

      const { data: userHoldings } = await supabase
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
      
      holdings = userHoldings || [];

      // Fetch current prices from daily_prices
      const stockIds = holdings?.map(h => (h.stocks as any)?.id).filter(Boolean) || [];
      if (stockIds.length > 0) {
        const { data: prices } = await supabase
          .from("daily_prices")
          .select("stock_id, close")
          .in("stock_id", stockIds)
          .order("date", { ascending: false });
          
        if (prices) {
          prices.forEach((p: any) => {
            if (!currentPrices[p.stock_id]) {
              currentPrices[p.stock_id] = p.close;
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching user portfolio from Supabase:", err);
    }
  }

  // Fallback demo holdings if no holdings logged yet
  if (holdings.length === 0) {
    holdings = [
      {
        id: "demo-1",
        quantity: 50,
        avg_buy_price: 3600,
        currentPrice: 3890,
        source: "manual",
        stocks: { id: 1, ticker: "TCS.NS", name: "Tata Consultancy Services", industry: "Information Technology" },
      },
      {
        id: "demo-2",
        quantity: 80,
        avg_buy_price: 2850,
        currentPrice: 2980,
        source: "manual",
        stocks: { id: 2, ticker: "RELIANCE.NS", name: "Reliance Industries", industry: "Energy & Petrochemicals" },
      },
      {
        id: "demo-3",
        quantity: 120,
        avg_buy_price: 1550,
        currentPrice: 1680,
        source: "manual",
        stocks: { id: 3, ticker: "HDFCBANK.NS", name: "HDFC Bank", industry: "Banking & Financials" },
      },
      {
        id: "demo-4",
        quantity: 200,
        avg_buy_price: 420,
        currentPrice: 475,
        source: "manual",
        stocks: { id: 4, ticker: "ITC.NS", name: "ITC Ltd", industry: "FMCG" },
      },
    ];
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
      userId={userId}
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
