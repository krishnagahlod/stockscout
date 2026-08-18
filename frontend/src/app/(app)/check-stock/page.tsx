import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScoreRow } from "../screener/score-row";
import { CheckStockSearchForm } from "./search-form";

export default async function CheckStockPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in.</div>;
  }

  const awaitedSearchParams = await searchParams;
  const ticker = typeof awaitedSearchParams.q === "string" ? awaitedSearchParams.q.toUpperCase() : null;

  let scoreResult = null;
  let stockData = null;

  const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
  const secretKey = process.env.FASTAPI_SECRET || "dev_shared_secret_key";

  if (ticker) {
    // Check if stock exists via backend
    try {
      const res = await fetch(`${backendUrl}/api/stocks?search=${ticker}&page_size=1`, { 
        cache: 'no-store',
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "X-API-Key": secretKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const item = data.items[0];
          stockData = {
            id: item.id,
            ticker: item.symbol,
            name: item.name,
            industry: item.industry
          };

          // Also get the score from backend
          const scoreRes = await fetch(`${backendUrl}/compute/score?user_id=${user.id}&stock_id=${item.id}`, { 
            cache: 'no-store',
            headers: {
              "Authorization": `Bearer ${secretKey}`,
              "X-API-Key": secretKey
            }
          });
          if (scoreRes.ok) {
             const scoreData = await scoreRes.json();
             if (scoreData && scoreData.combined_score !== undefined) {
               scoreResult = {
                  id: scoreData.id || 1,
                  computed_at: new Date().toISOString(),
                  fundamentals_score: scoreData.fundamentals_score || 50,
                  sector_score: scoreData.sector_score || 50,
                  news_score: scoreData.news_score || 50,
                  combined_score: scoreData.combined_score || 50,
                  risk_band: scoreData.risk_band || "moderate",
                  score_breakdown: scoreData.score_breakdown || {},
                  stocks: stockData
               };
             }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch stock from backend:", err);
    }
  }

  return (
          <div className="space-y-6 max-w-4xl mx-auto">
        <div className="text-center space-y-4 py-8">
          <Activity className="h-12 w-12 text-primary mx-auto opacity-80" />
          <h1 className="text-3xl font-bold tracking-tight">Check a Stock</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See how any stock fits into your portfolio. We score it based on your risk appetite, existing sector exposure, and recent news sentiment.
          </p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Search for a Stock</CardTitle>
            <CardDescription>Enter a ticker symbol to analyze its fit.</CardDescription>
          </CardHeader>
          <CardContent>
            <CheckStockSearchForm defaultValue={ticker?.replace('.NS', '') || ""} />
          </CardContent>
        </Card>

        {ticker && !stockData && (
          <div className="text-center py-8 text-muted-foreground">
            Stock <Badge variant="outline">{ticker.replace('.NS', '')}</Badge> not found in our database.
          </div>
        )}

        {ticker && stockData && !scoreResult && (
          <Card className="max-w-2xl mx-auto border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                We found <strong>{stockData.name} ({stockData.ticker.replace('.NS', '')})</strong>, but we haven't generated a personalized score for it yet.
              </p>
              <form action={async () => {
                "use server";
                const { generateScoresAction } = await import("../screener/actions");
                await generateScoresAction();
                // Redirect back to this page to see the new score
                const { redirect } = await import("next/navigation");
                redirect(`/check-stock?q=${ticker}`);
              }}>
                <Button type="submit">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Personalized Score Now
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {scoreResult && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold mt-8">Analysis Results</h3>
            <Card>
              <CardContent className="p-0">
                <ScoreRow score={scoreResult} rank={1} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-sm">Fundamentals Fit</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="text-2xl font-bold text-blue-500">{scoreResult.fundamentals_score}/100</p>
                   <p className="text-xs text-muted-foreground mt-2">{scoreResult.score_breakdown?.fundamentals_note}</p>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-sm">Sector Exposure Fit</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="text-2xl font-bold text-purple-500">{scoreResult.sector_score}/100</p>
                   <p className="text-xs text-muted-foreground mt-2">{scoreResult.score_breakdown?.sector_note}</p>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-sm">News Sentiment Fit</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="text-2xl font-bold text-orange-500">{scoreResult.news_score}/100</p>
                   <p className="text-xs text-muted-foreground mt-2">{scoreResult.score_breakdown?.news_note}</p>
                 </CardContent>
               </Card>
            </div>

            <div className="flex justify-center mt-8">
               <Link href={`/stocks/${scoreResult.stocks.ticker}`}>
                 <Button variant="outline" size="lg">
                   View Full Profile for {scoreResult.stocks.ticker.replace('.NS', '')}
                   <ArrowRight className="ml-2 h-4 w-4" />
                 </Button>
               </Link>
            </div>
          </div>
        )}
      </div>
      );
}

