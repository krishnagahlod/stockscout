"use client";

import { Shield, Sparkles, TrendingUp, DollarSign, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DVMScoreProps {
  score?: {
    overall: number;
    durability: number;
    valuation: number;
    momentum: number;
    piotroski_f: number;
  };
}

export function DVMScorecard({ score }: DVMScoreProps) {
  if (!score) return null;

  const getScoreColor = (val: number) => {
    if (val >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (val >= 45) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const getProgressColor = (val: number) => {
    if (val >= 70) return "bg-emerald-500";
    if (val >= 45) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getVerdict = (val: number) => {
    if (val >= 75) return "High Quality / Outperform";
    if (val >= 55) return "Moderate Quality / Neutral";
    return "High Risk / Caution";
  };

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Institutional Scorecard (DVM & Quality)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Durability, Valuation, and Technical Momentum breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border font-bold text-sm flex items-center gap-1.5 ${getScoreColor(score.overall)}`}>
            <span>DVM {score.overall}/100</span>
          </div>
          <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 font-semibold text-xs py-1">
            <Award className="w-3.5 h-3.5 mr-1" />
            Piotroski F: {score.piotroski_f}/9
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Durability */}
        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              Durability
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {score.durability}/100
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(score.durability)}`}
              style={{ width: `${score.durability}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Balance sheet leverage, ROCE stability, and cash flow health.
          </p>
        </div>

        {/* Valuation */}
        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Valuation
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {score.valuation}/100
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(score.valuation)}`}
              style={{ width: `${score.valuation}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Price-to-Earnings, P/B, and dividend yield vs historical median.
          </p>
        </div>

        {/* Momentum */}
        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
              Momentum
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {score.momentum}/100
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(score.momentum)}`}
              style={{ width: `${score.momentum}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Proximity to 52-week high, moving averages, and technical volume.
          </p>
        </div>
      </div>
    </div>
  );
}
