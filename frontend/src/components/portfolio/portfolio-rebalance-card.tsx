"use client";

import React, { useState } from "react";
import { usePortfolioRebalanceSheet, useNotifyPortfolioRebalance } from "@/hooks/use-portfolio";
import {
  RefreshCw,
  Sliders,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldCheck,
  Zap,
  ArrowRight,
  Bell,
  CheckCircle2,
  DollarSign,
  PieChart,
  SlidersHorizontal,
  Send,
  Sparkles,
} from "lucide-react";

interface PortfolioRebalanceCardProps {
  userId: string;
}

export function PortfolioRebalanceCard({ userId }: PortfolioRebalanceCardProps) {
  const [sizingMethod, setSizingMethod] = useState("risk_parity");
  const [capitalMode, setCapitalMode] = useState<"existing" | "fresh">("existing");
  const [additionalCapital, setAdditionalCapital] = useState<number>(200000);

  const { data: plan, isLoading, isError, refetch, isFetching } = usePortfolioRebalanceSheet(
    userId,
    sizingMethod,
    capitalMode,
    additionalCapital
  );

  const notifyMutation = useNotifyPortfolioRebalance();
  const [notifySuccess, setNotifySuccess] = useState(false);

  const handleDispatchNotify = async () => {
    try {
      await notifyMutation.mutateAsync({
        userId,
        capitalMode,
        additionalCapital,
      });
      setNotifySuccess(true);
      setTimeout(() => setNotifySuccess(false), 5000);
    } catch (err) {
      console.error("Failed to dispatch rebalance sheet notification:", err);
    }
  };

  if (isLoading && !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] gap-3 p-12 bg-white border border-slate-200 rounded-3xl shadow-2xs text-center animate-in fade-in-50 duration-300">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-1" />
        <h4 className="font-bold text-slate-800 text-lg tracking-tight">Computing Institutional Rebalance Schedule...</h4>
        <p className="text-xs font-medium text-slate-500 max-w-md leading-relaxed">
          Evaluating multi-factor alpha attribution, turnover minimization, and taxable event preservation across your holdings...
        </p>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="p-8 bg-white border border-rose-200 rounded-3xl text-center text-slate-700 shadow-sm space-y-3">
        <p className="font-bold text-slate-900 text-base">Could not calculate portfolio rebalance plan.</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please verify your active holdings and capital input parameters.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all"
        >
          Retry Rebalance Engine
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm text-slate-900 transition-all">
      {/* Top Header & Executive Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Institutional Rebalance & Factor Engine
            </span>
            {capitalMode === "fresh" && (
              <span className="text-xs font-black uppercase text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 flex items-center gap-1.5 shadow-xs animate-pulse">
                Zero Taxable Sells Mode Active
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Rebalance Execution & Multi-Factor Attribution
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed font-medium">
            {plan.executive_summary}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
          <button
            onClick={handleDispatchNotify}
            disabled={notifyMutation.isPending}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs border transition-all ${
              notifySuccess
                ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                : "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
            }`}
          >
            {notifyMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : notifySuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{notifySuccess ? "Alert Dispatched!" : "Email & Telegram Dispatch"}</span>
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-600 transition border border-slate-200 shadow-2xs"
            title="Recalculate trade orders"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Control Toolbar: Capital Mode & Sizing Method */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            Execution Sizing Methodology
          </label>
          <select
            value={sizingMethod}
            onChange={(e) => setSizingMethod(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-xs text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          >
            <option value="risk_parity">Risk Parity / Inverse Volatility (Defensive)</option>
            <option value="min_variance">Minimum Variance Allocation (Drawdown Protection)</option>
            <option value="max_sharpe">Maximum Sharpe Ratio (Momentum Weighted)</option>
            <option value="equal_weight">Equal Weight Allocation (Unweighted Baseline)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-slate-400" />
            Capital Deployment Strategy
          </label>
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setCapitalMode("existing")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-black transition ${
                capitalMode === "existing"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Rebalance Existing NAV
            </button>
            <button
              type="button"
              onClick={() => setCapitalMode("fresh")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-black transition ${
                capitalMode === "fresh"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Deploy Fresh Capital
            </button>
          </div>
        </div>

        {capitalMode === "fresh" && (
          <div className="space-y-2 animate-in fade-in-50 duration-300">
            <label className="text-xs font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              Fresh Cash Injection Amount (₹)
            </label>
            <input
              type="number"
              step="25000"
              value={additionalCapital}
              onChange={(e) => setAdditionalCapital(Number(e.target.value) || 0)}
              className="w-full px-3.5 py-2 bg-white border border-indigo-200 rounded-xl font-black text-sm text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
        )}
      </div>

      {/* Actionable Trade Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Actionable Trade Orders ({plan.orders.length})
          </h3>
          <div className="flex items-center gap-4 text-xs font-extrabold text-slate-600">
            <span>Turnover: <strong className="text-slate-900">{plan.estimated_turnover_pct}%</strong></span>
            <span>Est. Impact & STT: <strong className="text-slate-900">₹{plan.estimated_tx_cost_inr.toLocaleString("en-IN")}</strong> (20 bps)</span>
          </div>
        </div>

        {plan.orders.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200/80">
            No trade orders required for this methodology and capital mode.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs bg-white">
            <table className="w-full text-left border-collapse font-medium">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-black border-b border-slate-200/80">
                  <th className="p-4">Symbol</th>
                  <th className="p-4">Sector</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Share Delta</th>
                  <th className="p-4">Estimated Price</th>
                  <th className="p-4">Target Weight</th>
                  <th className="p-4">Institutional Guidance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {plan.orders.map((o, i) => {
                  const isBuy = o.action === "BUY" || o.action === "ADD";
                  const isSell = o.action === "SELL" || o.action === "TRIM";
                  const badgeStyle = isBuy
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isSell
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-700 border-slate-200";

                  return (
                    <tr key={i} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 font-black text-slate-900">{o.symbol}</td>
                      <td className="p-4 text-xs text-slate-500">{o.sector}</td>
                      <td className="p-4">
                        <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg border shadow-2xs ${badgeStyle}`}>
                          {o.action}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        {isBuy ? `+${o.shares_difference}` : o.shares_difference} shares
                      </td>
                      <td className="p-4 font-semibold">₹{o.estimated_price.toLocaleString("en-IN")}</td>
                      <td className="p-4 font-extrabold text-indigo-600">{o.target_weight_pct}%</td>
                      <td className="p-4 text-xs text-slate-600 max-w-sm leading-relaxed font-semibold">
                        {o.execution_guidance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-Factor Attribution Cards */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Quantitative Factor Attribution & Beta Anchoring
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plan.factor_attribution.map((f, idx) => {
            const isDominant = f.status === "DOMINANT DRIVER";
            return (
              <div key={idx} className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between shadow-2xs space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-sm">{f.factor_name}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${isDominant ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-slate-200 text-slate-700 border-slate-300"}`}>
                      {f.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 leading-relaxed">{f.description}</p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Factor Score Index: <strong className="text-slate-900">{f.score_index}/100</strong></span>
                  <span className="text-emerald-600 font-extrabold">+{f.contribution_pct}% Alpha</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
