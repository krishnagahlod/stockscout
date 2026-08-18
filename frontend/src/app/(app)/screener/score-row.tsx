"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function ScoreRow({ score, rank }: { score: any, rank: number }) {
  const stock = score.stocks;
  const isTop3 = rank <= 3;
  
  // Color coding for overall score
  let scoreColor = "text-amber-600 bg-amber-50 border border-amber-200/50";
  if (score.combined_score >= 80) scoreColor = "text-emerald-700 bg-emerald-50 border border-emerald-200/50";
  else if (score.combined_score < 40) scoreColor = "text-rose-600 bg-rose-50 border border-rose-200/50";

  return (
    <div className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 hover:bg-slate-50/80 transition-colors gap-4">
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm shadow-sm transition-transform group-hover:scale-105 ${
          isTop3 ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-500'
        }`}>
          {rank}
        </div>
        <div>
          <Link href={`/stocks/${stock.ticker}`} className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{stock.ticker.replace('.NS', '')}</span>
            <span className="text-sm font-medium text-slate-500 hidden sm:inline">{stock.name}</span>
          </Link>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-slate-500 border-slate-200 bg-white">{stock.industry}</Badge>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target: <span className="text-slate-600">{score.risk_band}</span></span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-8 w-full sm:w-auto">
        {/* Factor Breakdown */}
        <div className="hidden md:flex items-center gap-6 text-xs">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fund. (50%)</span>
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${score.fundamentals_score}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sector (30%)</span>
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${score.sector_score}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">News (20%)</span>
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${score.news_score}%` }}></div>
            </div>
          </div>
        </div>

        {/* Total Score */}
        <div className="flex flex-col items-end flex-shrink-0 ml-auto sm:ml-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Match Score</div>
          <div className={`text-2xl font-black px-4 py-1.5 rounded-xl shadow-sm ${scoreColor}`}>
            {Math.round(score.combined_score)}
          </div>
        </div>
      </div>
    </div>
  );
}
