"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export function PerformerCard({ stock }: { stock: any }) {
  const isPositive = stock.pnl_pct >= 0;
  
  return (
    <Link href={`/stocks/${stock.symbol.replace('.NS', '')}`} className="block">
      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white/50 dark:bg-slate-900/30">
        <div className="flex flex-col">
          <span className="font-bold text-sm text-slate-900 dark:text-white">{stock.symbol.replace('.NS', '')}</span>
          <span className="text-xs text-slate-500 truncate max-w-[120px]">{stock.name}</span>
        </div>
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${
          isPositive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span className="text-xs font-bold">{isPositive ? '+' : ''}{stock.pnl_pct.toFixed(2)}%</span>
        </div>
      </div>
    </Link>
  );
}
