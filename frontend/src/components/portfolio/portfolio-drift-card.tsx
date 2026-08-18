"use client";

import React from "react";
import { usePortfolioDrift } from "@/hooks/use-portfolio";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Bell,
  Sliders,
} from "lucide-react";

interface PortfolioDriftCardProps {
  userId: string;
}

export function PortfolioDriftCard({ userId }: PortfolioDriftCardProps) {
  const { data: report, isLoading, isError, refetch, isFetching } = usePortfolioDrift(userId);

  if (isLoading && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 p-12 bg-white border border-slate-200 rounded-3xl shadow-2xs text-center animate-in fade-in-50 duration-300">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-1" />
        <h4 className="font-bold text-slate-800 text-lg tracking-tight">Evaluating Real-Time Portfolio Drift...</h4>
        <p className="text-xs font-medium text-slate-500 max-w-md leading-relaxed">
          Scanning concentration boundaries, ATR trailing stops, and macro regime headwinds across your live holdings...
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
        <p className="font-bold text-slate-900 text-base">Unable to retrieve real-time drift metrics.</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Ensure your holding data is accessible and network connection is active.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all"
        >
          Retry Drift Analysis
        </button>
      </div>
    );
  }

  const isHealthy = report.health_status === "HEALTHY";
  const isNeedsRebalance = report.health_status === "NEEDS_REBALANCE";
  
  const badgeStyle = isHealthy
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isNeedsRebalance
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <div className="flex flex-col gap-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm text-slate-900 transition-all">
      {/* Top Header & Executive Commentary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full border flex items-center gap-1.5 shadow-xs ${badgeStyle}`}>
              {isHealthy ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              Health: {report.health_score}% ({report.health_status.replace(/_/g, " ")})
            </span>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5 shadow-xs">
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              Daily Post-Market Eval (4:00 PM IST)
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Live Portfolio Drift & Regime Watchtower
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed font-medium">
            {report.summary_commentary}
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-600 transition hover:text-slate-900 disabled:opacity-50 border border-slate-200/80 shadow-2xs self-start lg:self-center shrink-0"
          title="Refresh real-time drift evaluation"
        >
          <RefreshCw className={`w-5 h-5 ${isFetching ? "animate-spin text-amber-600" : ""}`} />
        </button>
      </div>

      {/* Macro Regime Headwind Notice */}
      {report.regime_warning && (
        <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white rounded-xl border border-amber-200 text-amber-600 shadow-2xs shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-black uppercase text-amber-800 tracking-wider block">
                Macro Regime Headwind ({report.regime_warning.current_regime})
              </span>
              <p className="text-xs text-amber-950 font-medium mt-0.5 leading-relaxed">
                {report.regime_warning.recommended_action}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-black uppercase bg-amber-500 text-white px-3 py-1 rounded-lg shrink-0 shadow-xs">
            Severity: {report.regime_warning.severity}
          </span>
        </div>
      )}

      {/* Holdings Drift Evaluation Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Current Scenario Trend Health & Volatility Audit ({(report?.holdings_drift ?? []).length})
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Live Trend & 14-Day ATR Support Protection</span>
        </div>

        {(report?.holdings_drift ?? []).length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200/80">
            No active portfolio positions available for drift evaluation.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {(report?.holdings_drift ?? []).map((hd: any, idx: number) => {
              const status = hd.status ?? "ALIGNED";
              const isBreached = status === "STOP_LOSS_BREACHED";
              const isDrifted = status === "DRIFTED" || status === "AT_RISK";
              const isTakeProfit = status === "TAKE_PROFIT_REACHED";

              const borderStyle = isBreached
                ? "bg-rose-50/40 border-rose-200"
                : isDrifted
                ? "bg-amber-50/40 border-amber-200"
                : isTakeProfit
                ? "bg-emerald-50/40 border-emerald-200"
                : "bg-white border-slate-200/80";

              return (
                <div
                  key={idx}
                  className={`flex flex-col p-5 rounded-2xl border transition-all hover:shadow-xs ${borderStyle}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-2 h-11 rounded-full ${
                          isBreached
                            ? "bg-rose-500"
                            : isDrifted
                            ? "bg-amber-500"
                            : isTakeProfit
                            ? "bg-emerald-500"
                            : "bg-emerald-600"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base">
                            {hd.symbol}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {hd.sector}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-500 line-clamp-1">{hd.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Current LTP</span>
                        <span className="font-extrabold text-slate-900">₹{hd.current_price?.toLocaleString("en-IN") ?? "0"}</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Active Volatility Support</span>
                        <span className="font-bold text-slate-700">₹{hd.stop_loss_price?.toLocaleString("en-IN") ?? "N/A"}</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Take Profit Target</span>
                        <span className="font-bold text-emerald-700">₹{hd.take_profit_price?.toLocaleString("en-IN") ?? "N/A"}</span>
                      </div>

                      <div>
                        <span
                          className={`text-xs font-black uppercase px-3 py-1 rounded-xl border shadow-2xs ${
                            isBreached
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : isDrifted
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : isTakeProfit
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Audit Reasons / Commentary */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                    {hd.reasons?.map((r: string, rIdx: number) => (
                      <span key={rIdx} className="bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-2xs flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
