import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { StockChart } from "./stock-chart";
import { NewsPanel } from "./news-panel";
import { FundamentalsGrid } from "./fundamentals-grid";
import { DVMScorecard } from "./dvm-scorecard";
import { FinancialStatements } from "./financial-statements";
import { ShareholdingPattern } from "./shareholding-pattern";
import { PeerComparison } from "./peer-comparison";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles } from "lucide-react";

export default async function StockProfilePage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();

  const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
  const apiKey = process.env.FASTAPI_SECRET || "";

  let stock: any = null;
  let fundamentals: any = null;
  let prices: any[] = [];
  let news: any[] = [];
  let financialStatements: any = null;
  let shareholding: any[] = [];
  let peers: any[] = [];
  let dvmScore: any = null;
  let aiAnalysis = "";

  // 1. Fetch from FastAPI backend with Stale-While-Revalidate caching
  try {
    const res = await fetch(`${backendUrl}/api/stocks/${decodedTicker}`, {
      headers: { "X-API-Key": apiKey },
      next: { revalidate: 120 },
    });
    if (res.ok) {
      const data = await res.json();
      stock = data;
      fundamentals = data.fundamentals || null;
      prices = data.prices || [];
      news = data.news || [];
      financialStatements = data.financial_statements || null;
      shareholding = data.shareholding || [];
      peers = data.peers || [];
      dvmScore = data.dvm_score || null;
    }
  } catch (err) {
    console.error("Backend stock fetch error, trying Supabase...", err);
  }

  // 2. Fallback to direct Supabase client if backend didn't return stock
  if (!stock) {
    try {
      const supabase = await createClient();
      const { data: sbStock } = await supabase
        .from("stocks")
        .select("*")
        .eq("ticker", decodedTicker)
        .single();

      if (sbStock) {
        stock = sbStock;
        const { data: sbFund } = await supabase
          .from("stock_fundamentals")
          .select("*")
          .eq("stock_id", stock.id)
          .order("as_of_date", { ascending: false })
          .limit(1)
          .single();
        fundamentals = sbFund || null;

        const { data: rawPrices } = await supabase
          .from("daily_prices")
          .select("*")
          .eq("stock_id", stock.id)
          .order("date", { ascending: false })
          .limit(90);
        prices = rawPrices ? [...rawPrices].reverse() : [];

        const { data: sbNews } = await supabase
          .from("news_items")
          .select("*")
          .eq("stock_id", stock.id)
          .order("published_at", { ascending: false })
          .limit(5);
        news = sbNews || [];
      }
    } catch (sbErr) {
      console.error("Supabase stock fetch error:", sbErr);
    }
  }

  if (!stock) {
    notFound();
  }

  // Ensure ticker field exists
  if (!stock.ticker) {
    stock.ticker = stock.symbol || decodedTicker;
  }

  // 3. Fetch AI News Analysis (graceful non-blocking)
  try {
    const aiRes = await fetch(`${backendUrl}/api/llm/news-analysis/${stock.ticker}`, {
      headers: { "X-API-Key": apiKey },
      next: { revalidate: 300 },
    });
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {stock.name}
            </h1>
            <Badge variant="outline" className="font-mono text-xs font-bold px-2.5 py-0.5">
              {stock.ticker.replace(".NS", "")}
            </Badge>
            {stock.is_index_member && (
              <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50">
                {stock.index_name || "NIFTY 500"}
              </Badge>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm font-medium">
            {stock.exchange || "NSE"} · {stock.sector || "General"} · {stock.industry || "Diversified"}
          </p>
        </div>

        <div className="text-right">
          <div className="text-4xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
            ₹{currentPrice.toFixed(2)}
          </div>
          <div
            className={`flex items-center justify-end gap-1 text-sm font-bold mt-1 ${
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            <span>₹{Math.abs(dayChange).toFixed(2)}</span>
            <span>({Math.abs(dayChangePct).toFixed(2)}%) Today</span>
          </div>
        </div>
      </div>

      {/* DVM Scorecard (Durability, Valuation, Momentum) */}
      {dvmScore && <DVMScorecard score={dvmScore} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interactive Price Chart with Timeframes */}
          <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Interactive Price Chart</CardTitle>
              <CardDescription>Candle history & timeframe analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <StockChart data={prices || []} />
            </CardContent>
          </Card>

          {/* Key Fundamentals Grid */}
          <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Key Valuation & Quality Ratios</CardTitle>
              <CardDescription>
                Audited as of {fundamentals?.as_of_date || "Latest Period"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FundamentalsGrid fundamentals={fundamentals} />
            </CardContent>
          </Card>

          {/* 5-Year Consolidated Financial Statements */}
          <FinancialStatements statements={financialStatements} />

          {/* Shareholding Pattern Trends */}
          <ShareholdingPattern shareholding={shareholding} />

          {/* Sector Peer Comparison Matrix */}
          <PeerComparison peers={peers} currentSymbol={stock.ticker} />
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800 shadow-xs sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                AI News & Thesis Synthesis
              </CardTitle>
              <CardDescription>Event analysis and sentiment overview</CardDescription>
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
