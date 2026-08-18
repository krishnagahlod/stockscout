"use client";

import React, { useState } from "react";
import { usePortfolioPlaybook } from "@/hooks/use-portfolio";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sliders,
  Bell,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  Lock,
  Globe,
} from "lucide-react";

interface PortfolioPlaybookCardProps {
  userId: string;
}

export function PortfolioPlaybookCard({ userId }: PortfolioPlaybookCardProps) {
  const { data: report, isLoading, isError, refetch, isFetching } = usePortfolioPlaybook(userId);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  if (isLoading && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 p-12 bg-white border border-slate-200 rounded-3xl shadow-2xs text-center animate-in fade-in-50 duration-300">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-1" />
        <h4 className="font-bold text-slate-800 text-lg tracking-tight">Generating AI Quant Playbook...</h4>
        <p className="text-xs font-medium text-slate-500 max-w-md leading-relaxed">
          Computing 14-day dynamic ATR trailing stops, 8% hard capital defense floors, and technical entry zones across your active holdings...
        </p>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="p-8 bg-white border border-rose-200 rounded-3xl text-center text-slate-700 shadow-sm space-y-3">
        <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-900 text-base">Could not generate AI Playbook for this portfolio.</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Verify your holdings have live market price updates synced and try checking again.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all"
        >
          Retry Playbook Evaluation
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm text-slate-900 transition-all">
      {/* Top Header & Executive Commentary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50/80 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              AI Quant Watchtower Active
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              8% Capital Defense Floor Enabled
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Portfolio Quant Playbook & Trailing Stops
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed font-medium">
            {report?.executive_commentary ?? "Live quant defense indicators actively evaluated against intraday price regimes."}
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-600 transition hover:text-slate-900 disabled:opacity-50 border border-slate-200/80 shadow-2xs self-start lg:self-center shrink-0"
          title="Refresh real-time ATR & quant signals"
        >
          <RefreshCw className={`w-5 h-5 ${isFetching ? "animate-spin text-indigo-600" : ""}`} />
        </button>
      </div>

      {/* Live Macro Regime Context Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-indigo-600 shadow-2xs">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-extrabold text-slate-400 block">Macro Environment</span>
            <span className="text-sm font-black text-slate-900">
              {report?.macro_context?.current_regime?.replace(/_/g, " ") ?? "BULL LOW VOL"} (VIX: {report?.macro_context?.vix_value ?? "14.5"})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-emerald-600 shadow-2xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-extrabold text-slate-400 block">Risk Budget Limit</span>
            <span className="text-sm font-black text-slate-900">
              {report?.risk_budget?.max_drawdown_limit_pct ?? "8.0"}% Max Drawdown Guardrail
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-amber-600 shadow-2xs">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-extrabold text-slate-400 block">Recommended Cash Buffer</span>
            <span className="text-sm font-black text-slate-900">
              {report?.risk_budget?.recommended_cash_buffer_pct ?? "12.5"}% Cash Allocation
            </span>
          </div>
        </div>
      </div>

      {/* Holdings Playbook Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Active Holdings Guidance & ATR Defense ({(report?.holdings_playbook ?? []).length})
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Click holding to reveal fundamental watchtower & news</span>
        </div>

        {(report?.holdings_playbook ?? []).length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200/80">
            No active holdings found in your primary portfolio.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {(report?.holdings_playbook ?? []).map((hp: any) => {
              const isExpanded = expandedSymbol === hp.symbol;
              const guidanceText = hp?.guidance_commentary ?? "";
              const isWarning = guidanceText.includes("BREACH") || guidanceText.includes("BREAKDOWN");
              const isHarvest = guidanceText.includes("PROFIT TARGET") || guidanceText.includes("OVERBOUGHT");

              const borderStyle = isWarning
                ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
                : isHarvest
                ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300"
                : "bg-white border-slate-200/80 hover:border-indigo-200";

              return (
                <div
                  key={hp.symbol}
                  onClick={() => setExpandedSymbol(isExpanded ? null : hp.symbol)}
                  className={`cursor-pointer group flex flex-col p-5 rounded-2xl border transition-all hover:shadow-xs ${borderStyle}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-2 h-11 rounded-full ${
                          isWarning ? "bg-rose-500" : isHarvest ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition">
                            {hp.symbol}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {hp.sector}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-500 line-clamp-1">{hp.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Current LTP</span>
                        <span className="font-extrabold text-slate-900">₹{hp.current_price.toLocaleString("en-IN")}</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-rose-500" /> ATR Trailing Stop
                        </span>
                        <span className="font-black text-rose-600">₹{hp.atr_stop_loss.toLocaleString("en-IN")}</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-600" /> Target Price
                        </span>
                        <span className="font-extrabold text-emerald-700">₹{hp.take_profit_target.toLocaleString("en-IN")}</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Stop Buffer</span>
                        <span className="font-bold text-slate-700">{hp.stop_distance_pct}% from LTP</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 rounded-xl text-xs font-extrabold shadow-2xs">
                          RSI: {hp.rsi_signal}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Guidance Commentary & Details */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {hp.guidance_commentary}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                      <div>
                        <span className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px] mb-1.5">
                          Recent Macro Catalyst / Institutional News:
                        </span>
                        <p className="text-slate-700 font-medium leading-relaxed bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                          {hp.recent_catalyst_news}
                        </p>
                      </div>

                      <div>
                        <span className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px] mb-1.5">
                          Fundamental Watchtower Indicators:
                        </span>
                        <ul className="space-y-1 bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                          {hp.fundamental_watch_metrics?.map((wm: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <span className="text-indigo-500 font-bold">•</span>
                              <span>{wm}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
