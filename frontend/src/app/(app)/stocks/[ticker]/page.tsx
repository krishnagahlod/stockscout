import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { StockChart } from "./stock-chart";
import { NewsPanel } from "./news-panel";
import { FundamentalsGrid } from "./fundamentals-grid";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

export default async function StockProfilePage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();

  const supabase = await createClient();

  // 1. Fetch Stock Details
  const { data: stock, error: stockError } = await supabase
    .from("stocks")
    .select("*")
    .eq("ticker", decodedTicker)
    .single();

  if (stockError || !stock) {
    notFound();
  }

  // 2. Fetch Latest Fundamentals
  const { data: fundamentals } = await supabase
    .from("stock_fundamentals")
    .select("*")
    .eq("stock_id", stock.id)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .single();

  // 3. Fetch Prices for Chart (Last 90 days)
  const { data: rawPrices } = await supabase
    .from("daily_prices")
    .select("*")
    .eq("stock_id", stock.id)
    .order("date", { ascending: false })
    .limit(90);
    
  const prices = rawPrices ? [...rawPrices].reverse() : [];

  // 4. Fetch News
  const { data: news } = await supabase
    .from("news_items")
    .select("*")
    .eq("stock_id", stock.id)
    .order("published_at", { ascending: false })
    .limit(5);

  // 5. Fetch AI News Analysis
  const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
  let aiAnalysis = "";
  try {
    const aiRes = await fetch(`${backendUrl}/api/llm/news-analysis/${stock.ticker}`, { cache: 'no-store' });
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      aiAnalysis = aiData.analysis || "";
    }
  } catch (err) {
    console.error("Failed to fetch AI news analysis", err);
  }

  // Calculate day change if we have at least 2 prices
  let currentPrice = 0;
  let dayChange = 0;
  let dayChangePct = 0;
  
  if (prices && prices.length >= 2) {
    const latest = prices[prices.length - 1];
    const prev = prices[prices.length - 2];
    currentPrice = latest.close;
    dayChange = latest.close - prev.close;
    dayChangePct = (dayChange / prev.close) * 100;
  } else if (prices && prices.length === 1) {
    currentPrice = prices[0].close;
  }

  const isPositive = dayChange >= 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{stock.name}</h1>
            <Badge variant="outline">{stock.ticker.replace('.NS', '')}</Badge>
            {stock.is_index_member && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                {stock.index_name}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {stock.exchange} • {stock.industry || "General"}
          </p>
        </div>

        <div className="text-right">
          <div className="text-4xl font-bold font-mono">
            ₹{currentPrice.toFixed(2)}
          </div>
          <div
            className={`flex items-center justify-end gap-1 font-medium ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-5 w-5" />
            ) : (
              <ArrowDownRight className="h-5 w-5" />
            )}
            <span>{Math.abs(dayChange).toFixed(2)}</span>
            <span>({Math.abs(dayChangePct).toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Price History (90 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <StockChart data={prices || []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Fundamentals</CardTitle>
              <CardDescription>
                As of {fundamentals?.as_of_date || "N/A"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FundamentalsGrid fundamentals={fundamentals} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                AI News Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NewsPanel news={news || []} aiAnalysis={aiAnalysis} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
