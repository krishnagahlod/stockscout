"use client";

import React, { useState } from "react";
import { useStrategyDrift } from "@/hooks/use-monitor";
import { StrategyDriftReport, HoldingDrift } from "@/lib/api";
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Info,
  Sliders,
  Send,
  Bell,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

interface DriftMonitorCardProps {
  strategyId: number;
  initialReport?: StrategyDriftReport | null;
}

export function DriftMonitorCard({ strategyId, initialReport }: DriftMonitorCardProps) {
  const { data, isLoading, isError, refetch, isFetching } = useStrategyDrift(strategyId);
  const report = data || initialReport;
  const [filter, setFilter] = useState<"ALL" | "ISSUES">("ALL");
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);

  if (isLoading && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 p-12 bg-white border border-slate-200 rounded-3xl shadow-2xs text-center animate-in fade-in-50 duration-300">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-1" />
        <h4 className="font-bold text-slate-800 text-lg tracking-tight">Evaluating Live Strategy Drift...</h4>
        <p className="text-xs font-medium text-slate-500 max-w-md leading-relaxed">
          Scanning portfolio positions against ATR volatility thresholds, technical regime boundaries, and macro sentiment factors...
        </p>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="p-8 bg-white border border-rose-200 rounded-3xl text-center text-slate-700 shadow-sm space-y-3">
        <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-900 text-base">Could not load live drift report for this strategy.</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please verify that market price feeds are synced and the strategy rules are valid.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all"
        >
          Retry Monitor Check
        </button>
      </div>
    );
  }

  const isCritical = report.health_status === "CRITICAL_INTERVENTION";
  const needsRebalance = report.health_status === "NEEDS_REBALANCE";
  const isHealthy = report.health_status === "HEALTHY";

  const statusColor = isCritical
    ? "text-rose-700 border-rose-200 bg-rose-50"
    : needsRebalance
    ? "text-amber-700 border-amber-200 bg-amber-50"
    : "text-emerald-700 border-emerald-200 bg-emerald-50";

  const barColor = isCritical
    ? "bg-gradient-to-r from-rose-500 to-rose-600"
    : needsRebalance
    ? "bg-gradient-to-r from-amber-400 to-amber-500"
    : "bg-gradient-to-r from-emerald-500 to-emerald-600";

  const filteredHoldings = report.holdings_drift.filter((h) =>
    filter === "ISSUES" ? h.status !== "ALIGNED" : true
  );

  const issueCount = report.holdings_drift.filter((h) => h.status !== "ALIGNED").length;

  return (
    <div className="flex flex-col gap-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm text-slate-900 transition-all">
      {/* Top Health Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50/80 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Live Drift Engine
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-xs">
              <Bell className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              Resend + Telegram Active
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Strategy Health & Drift Monitor
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed font-medium">
            {report.summary_commentary}
          </p>
        </div>

        {/* Health Gauge Box */}
        <div className="flex items-center gap-6 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shrink-0 shadow-xs">
          <div className="relative flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-slate-100 flex items-center justify-center bg-white shadow-inner">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {Math.round(report.health_score)}
                <span className="text-sm font-bold text-slate-500">%</span>
              </span>
            </div>
            <div
              className={`absolute bottom-0 w-full h-1.5 rounded-full shadow-sm ${barColor}`}
              style={{ width: `${report.health_score}%` }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              System Status
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border shadow-2xs uppercase tracking-wide ${statusColor}`}
            >
              {isCritical ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              ) : needsRebalance ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {report.health_status.replace("_", " ")}
            </span>
            <div className="text-[11px] font-medium text-slate-400 pt-0.5">
              Checked: {new Date(report.checked_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-white hover:bg-slate-100 rounded-xl text-slate-600 transition hover:text-slate-900 disabled:opacity-50 border border-slate-200 shadow-xs"
            title="Re-evaluate live drift"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Regime Drift Warning Banner */}
      {report.regime_warning && (
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-4 shadow-2xs">
          <div className="p-2.5 bg-amber-100 rounded-xl shrink-0 mt-0.5 border border-amber-200 text-amber-700">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-2 text-xs">
              Macro Regime Headwind ({report.regime_warning.current_regime})
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 border border-amber-300">
                {report.regime_warning.severity.toUpperCase()} SEVERITY
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed font-medium text-xs">
              {report.regime_warning.recommended_action}
            </p>
          </div>
        </div>
      )}

      {/* Holdings Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Portfolio Holdings Drift Evaluation ({report.holdings_drift.length})
            </h3>
            {issueCount > 0 && (
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                {issueCount} Requiring Attention
              </span>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                filter === "ALL" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Holdings ({report.holdings_drift.length})
            </button>
            <button
              onClick={() => setFilter("ISSUES")}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                filter === "ISSUES"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-rose-700"
              }`}
            >
              Drifted & Breaches ({issueCount})
            </button>
          </div>
        </div>

        {filteredHoldings.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200/80">
            No holdings found matching filter criteria. All positions are fully aligned with strategy rules!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredHoldings.map((h) => {
              const isStopBreached = h.status === "STOP_LOSS_BREACHED";
              const isTakeProfit = h.status === "TAKE_PROFIT_REACHED";
              const isDrifted = h.status === "DRIFTED" || h.status === "AT_RISK";
              const isAligned = h.status === "ALIGNED";
              const isExpanded = expandedHolding === h.symbol;

              const badgeStyle = isStopBreached
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : isTakeProfit
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : isDrifted
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";

              return (
                <div
                  key={h.symbol}
                  onClick={() => setExpandedHolding(isExpanded ? null : h.symbol)}
                  className={`cursor-pointer group flex flex-col p-5 rounded-2xl border transition-all ${
                    isStopBreached
                      ? "bg-rose-50/40 border-rose-200 hover:border-rose-300 hover:shadow-xs"
                      : isDrifted
                      ? "bg-amber-50/40 border-amber-200 hover:border-amber-300 hover:shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-indigo-200 hover:shadow-xs"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Symbol & Name */}
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-2 h-11 rounded-full ${
                          isStopBreached ? "bg-rose-500" : isDrifted ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition">
                            {h.symbol.replace('.NS', '')}
                          </span>
                          {h.sector && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {h.sector}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-500 line-clamp-1">{h.name}</span>
                      </div>
                    </div>

                    {/* Price & Stops */}
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">LTP Price</span>
                        <span className="font-extrabold text-slate-900">₹{h.current_price.toLocaleString("en-IN")}</span>
                      </div>

                      {h.stop_loss_price && (
                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-rose-500" /> Stop Level
                          </span>
                          <span className="font-bold text-slate-700">₹{h.stop_loss_price.toLocaleString("en-IN")}</span>
                        </div>
                      )}

                      {h.take_profit_price && (
                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-600" /> Target
                          </span>
                          <span className="font-bold text-slate-700">₹{h.take_profit_price.toLocaleString("en-IN")}</span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl border uppercase tracking-wide shadow-2xs ${badgeStyle}`}
                        >
                          {h.status.replace("_", " ")}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Reasons */}
                  {(isExpanded || isStopBreached || isDrifted) && (
                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-700 space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      <span className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px] mb-1.5">
                        Automated Factor & Technical Analysis:
                      </span>
                      {h.reasons.map((reason, idx) => (
                        <p key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-700">
                          <span className="text-indigo-500 font-bold">•</span>
                          <span className="leading-relaxed">{reason}</span>
                        </p>
                      ))}
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
