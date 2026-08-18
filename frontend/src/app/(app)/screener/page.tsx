import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCcw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { generateScoresAction } from "./actions";
import { ScoreRow } from "./score-row";
import { GenerateButton } from "./generate-button";

export default async function ScreenerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in.</div>;
  }

  // Fetch top 10 scores from backend
  const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
  const secretKey = process.env.FASTAPI_SECRET || "dev_shared_secret_key";
  let scores: any[] = [];
  try {
    const res = await fetch(`${backendUrl}/compute/scores/top?user_id=${user.id}`, { 
      cache: 'no-store',
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "X-API-Key": secretKey
      }
    });
    if (res.ok) {
      scores = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch top scores:", err);
  }

  const hasScores = scores && scores.length > 0;
  const lastComputed = hasScores ? new Date(scores[0].computed_at).toLocaleString() : "Never";

  return (
          <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Scoring Engine</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Personalized Top Picks</h2>
            <p className="text-slate-500 mt-1.5 max-w-xl">
              Stocks ranked by their fit for your portfolio (Fundamentals, Sector, News).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/screener/manual">
              <Button variant="outline" className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">Manual Filter</Button>
            </Link>
            <form action={generateScoresAction}>
              <GenerateButton isFirstTime={false} />
            </form>
          </div>
        </div>

        {!hasScores ? (
          <div className="glass-card flex flex-col items-center justify-center p-16 text-center rounded-3xl border-dashed border-2 border-slate-200">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="h-10 w-10 text-indigo-300" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">No personalized picks yet</h3>
            <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
              We haven't generated your personalized stock scores yet. We'll analyze the universe of stocks against your risk profile and current portfolio sector concentration.
            </p>
            <form action={generateScoresAction}>
              <GenerateButton isFirstTime={true} />
            </form>
          </div>
        ) : (
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-6 bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Top 10 Matches</h3>
              </div>
              <div className="text-xs font-medium text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                Last updated: {lastComputed}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {scores.map((score, index) => (
                <ScoreRow key={score.id} score={score} rank={index + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
      );
}

