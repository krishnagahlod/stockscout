"use client";

import { Activity } from "lucide-react";

export function RegimeBadge({ regime }: { regime: any }) {
  const isBull = regime?.regime === "bull";
  const isBear = regime?.regime === "bear";
  
  let color = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  if (isBull) color = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400";
  if (isBear) color = "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400";

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${color}`}>
      <Activity className="w-4 h-4" />
      <span className="text-xs font-bold uppercase tracking-wider">{regime?.regime || 'Unknown'} Regime</span>
    </div>
  );
}
