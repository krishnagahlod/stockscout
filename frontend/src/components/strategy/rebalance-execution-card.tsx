"use client";

import React, { useState } from "react";
import { useRebalancePlan, useNotifyRebalance } from "@/hooks/use-rebalance";
import {
  Sliders,
  Send,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Shield,
  PieChart,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Zap,
  Layers,
  Sparkles,
} from "lucide-react";

interface RebalanceExecutionCardProps {
  strategyId: number;
}

export function RebalanceExecutionCard({ strategyId }: RebalanceExecutionCardProps) {
  const [capital, setCapital] = useState<number>(500000);
  const [inputCapital, setInputCapital] = useState<string>("500000");
  const [activeTab, setActiveTab] = useState<"ORDERS" | "FACTORS" | "SECTORS">("ORDERS");
  const [orderFilter, setOrderFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [notifySuccess, setNotifySuccess] = useState<boolean>(false);

  const { data: plan, isLoading, isError, refetch, isFetching } = useRebalancePlan(strategyId, capital);
  const notifyMutation = useNotifyRebalance();

  const handleCapitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inputCapital.replace(/,/g, ""));
    if (!isNaN(val) && val >= 1000) {
      setCapital(val);
    }
  };

  const handlePresetCapital = (amt: number) => {
    setCapital(amt);
    setInputCapital(amt.toString());
  };

  const handleDispatchNotification = async () => {
    try {
      await notifyMutation.mutateAsync({ strategyId, capital });
      setNotifySuccess(true);
      setTimeout(() => setNotifySuccess(false), 5000);
    } catch (err) {
      console.error("Failed to send rebalance sheet:", err);
    }
  };

  if (isLoading && !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] gap-3 p-12 bg-white border border-slate-200 rounded-3xl shadow-2xs text-center animate-in fade-in-50 duration-300">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-1" />
        <h4 className="font-bold text-slate-800 text-lg tracking-tight">Generating Rebalance Sheet & Attribution...</h4>
        <p className="text-xs font-medium text-slate-500 max-w-md leading-relaxed">
          Computing position target weights, execution turnover schedules, and multi-factor attribution models...
        </p>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="p-8 bg-white border border-rose-200 rounded-3xl text-center text-slate-700 shadow-sm space-y-3">
        <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-900 text-base">Unable to generate Rebalance Execution Plan</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Ensure this strategy has valid quantitative rules and recent market prices have been synced.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  const buyOrders = plan.orders.filter((o) => o.action === "BUY" || o.action === "ADD");
  const sellOrders = plan.orders.filter((o) => o.action === "SELL" || o.action === "TRIM");
  const filteredOrders = plan.orders.filter((o) => {
    if (orderFilter === "BUY") return o.action === "BUY" || o.action === "ADD";
    if (orderFilter === "SELL") return o.action === "SELL" || o.action === "TRIM";
    return true;
  });

  return (
    <div className="flex flex-col gap-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm text-slate-900 transition-all">
      {/* Top Title & Executive Summary Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50/80 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
              Institutional Rebalance & Attribution
            </span>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5 shadow-xs">
              Sizing Engine: <b className="text-emerald-700 uppercase font-extrabold">{plan.position_sizing_method}</b>
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Actionable Trade List & Factor Deconstruction
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed font-medium">
            {plan.executive_summary}
          </p>
        </div>

        {/* Dispatch Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <button
            onClick={handleDispatchNotification}
            disabled={notifyMutation.isPending || notifySuccess}
            className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
              notifySuccess
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
            }`}
          >
            {notifyMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white/80" />
            ) : notifySuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <Send className="w-4 h-4 text-indigo-100" />
            )}
            {notifySuccess ? "Sheet Dispatched!" : "Dispatch to Telegram & Email"}
          </button>
        </div>
      </div>

      {/* Capital Scaling & Summary Dashboard Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/80 p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        {/* Capital Control Form */}
        <div className="lg:col-span-1 space-y-3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-200 pb-5 lg:pb-0 lg:pr-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-indigo-600" /> Portfolio Investment NAV
            </label>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200 uppercase">
              INR Base
            </span>
          </div>
          <form onSubmit={handleCapitalSubmit} className="flex gap-2.5">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₹</span>
              <input
                type="text"
                value={inputCapital}
                onChange={(e) => setInputCapital(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-8 pr-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
            <button
              type="submit"
              className="px-4.5 py-2 bg-slate-900 hover:bg-slate-800 font-extrabold text-xs text-white rounded-xl shadow-xs transition-all"
            >
              Scale
            </button>
          </form>
          <div className="flex items-center gap-2 pt-1">
            {[100000, 500000, 2500000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handlePresetCapital(amt)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all shadow-2xs ${
                  capital === amt
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                ₹{(amt / 100000).toFixed(0)}L
              </button>
            ))}
          </div>
        </div>

        {/* Key Execution Metrics */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 items-center">
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 flex flex-col justify-center shadow-2xs">
            <span className="text-xs font-bold text-slate-500 mb-1">Total Active Orders</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{plan.orders.length}</span>
              <span className="text-xs font-extrabold text-emerald-600">+{buyOrders.length} Buys</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1">
              {sellOrders.length} positions trimming
            </span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 flex flex-col justify-center shadow-2xs">
            <span className="text-xs font-bold text-slate-500 mb-1">Estimated Turnover</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600">{plan.estimated_turnover_pct}%</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1">Of portfolio capital base</span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 flex flex-col justify-center shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-slate-500 mb-1">Est. Transaction Costs</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">
                ₹{plan.estimated_tx_cost_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1">20 bps execution & taxes</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 flex-wrap">
          <button
            onClick={() => setActiveTab("ORDERS")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-xs ${
              activeTab === "ORDERS"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" /> Trade Order Sheet ({plan.orders.length})
          </button>
          <button
            onClick={() => setActiveTab("FACTORS")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-xs ${
              activeTab === "FACTORS"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" /> Factor Attribution ({plan.factor_attribution.length})
          </button>
          <button
            onClick={() => setActiveTab("SECTORS")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-xs ${
              activeTab === "SECTORS"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <PieChart className="w-4 h-4 shrink-0" /> Sector Alpha Breakdown ({plan.sector_attribution.length})
          </button>
        </div>

        {/* TAB 1: ORDER SHEET */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Filter Execution Schedule:
              </span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setOrderFilter("ALL")}
                  className={`px-3.5 py-1.5 rounded-lg transition font-bold ${
                    orderFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Orders ({plan.orders.length})
                </button>
                <button
                  onClick={() => setOrderFilter("BUY")}
                  className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1 font-bold ${
                    orderFilter === "BUY" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-emerald-700"
                  }`}
                >
                  <ArrowUpRight className={`w-3.5 h-3.5 ${orderFilter === "BUY" ? "text-white" : "text-emerald-600"}`} /> Buys & Adds ({buyOrders.length})
                </button>
                <button
                  onClick={() => setOrderFilter("SELL")}
                  className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1 font-bold ${
                    orderFilter === "SELL" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-rose-700"
                  }`}
                >
                  <ArrowDownRight className={`w-3.5 h-3.5 ${orderFilter === "SELL" ? "text-white" : "text-rose-600"}`} /> Trims & Sells ({sellOrders.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {filteredOrders.map((o) => {
                const isBuy = o.action === "BUY" || o.action === "ADD";
                const isSell = o.action === "SELL" || o.action === "TRIM";
                const badgeStyle = isBuy
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isSell
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <div
                    key={o.symbol}
                    className="flex flex-col p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-xs transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left Symbol Info */}
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-2 h-12 rounded-full ${
                            isBuy ? "bg-emerald-500" : isSell ? "bg-amber-500" : "bg-blue-500"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-base">{o.symbol.replace('.NS', '')}</span>
                            {o.sector && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                {o.sector}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-500">{o.name}</span>
                        </div>
                      </div>

                      {/* Right Metrics */}
                      <div className="flex items-center gap-6 text-sm flex-wrap">
                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block">Est. Price</span>
                          <span className="font-extrabold text-slate-900">
                            ₹{o.estimated_price.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block">Share Delta</span>
                          <span className={`font-black text-base ${isBuy ? "text-emerald-600" : isSell ? "text-amber-600" : "text-slate-700"}`}>
                            {o.shares_difference > 0 ? `+${o.shares_difference}` : o.shares_difference} shares
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block">Order Value</span>
                          <span className="font-black text-indigo-600">
                            ₹{o.estimated_order_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 block">
                            ({o.target_weight_pct}% weight)
                          </span>
                        </div>

                        {/* Action Badge */}
                        <span className={`text-xs font-black px-4 py-1.5 rounded-xl border uppercase tracking-wide shadow-2xs ${badgeStyle}`}>
                          {o.action}
                        </span>
                      </div>
                    </div>

                    {/* Guidance Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <p className="text-slate-700 leading-relaxed font-medium">
                        <b className="text-slate-900 font-extrabold">Execution Guidance:</b> {o.execution_guidance}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: FACTOR ATTRIBUTION */}
        {activeTab === "FACTORS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.factor_attribution.map((f, idx) => {
              const isDominant = f.status === "DOMINANT DRIVER";
              const isDetracting = f.status === "DETRACTING";
              const barColor = isDominant
                ? "from-emerald-500 to-emerald-600"
                : isDetracting
                ? "from-rose-500 to-rose-600"
                : "from-indigo-500 to-blue-600";

              return (
                <div
                  key={idx}
                  className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between gap-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-black text-slate-900 text-base tracking-tight">{f.factor_name}</h4>
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase shadow-2xs ${
                          isDominant
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isDetracting
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {f.description}
                    </p>
                  </div>

                  {/* Factor Score & Contribution Bars */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-bold">Factor Strength Index</span>
                        <span className="font-black text-slate-900">{f.score_index} / 100</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80">
                        <div
                          className={`h-full bg-gradient-to-r ${barColor} rounded-full shadow-2xs`}
                          style={{ width: `${Math.min(f.score_index, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-slate-600 font-bold">Estimated Return Explained:</span>
                      <span className="font-black text-emerald-600 text-sm">{f.contribution_pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: SECTOR BREAKDOWN */}
        {activeTab === "SECTORS" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-slate-50 to-indigo-50/30 border border-indigo-100 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-700 font-medium">
              <span>
                <b className="text-indigo-900 font-extrabold">Benchmark Reference:</b> Broad Nifty 50 Sector Allocation distribution.
              </span>
              <span className="text-slate-600 font-semibold">
                Active Overweights represent concentrated alpha bets derived from macro sentiment rotation.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {plan.sector_attribution.map((sec, idx) => {
                const isOverweight = sec.relative_weight_pct > 0;
                const alphaColor = sec.contribution_to_alpha_pct >= 0 ? "text-emerald-600" : "text-amber-600";

                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 md:max-w-md">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-extrabold text-slate-900 text-base">{sec.sector}</span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase shadow-2xs ${
                            isOverweight
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {isOverweight ? `+${sec.relative_weight_pct}% OVERWEIGHT` : `${sec.relative_weight_pct}% UNDERWEIGHT`}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed pt-1">
                        {sec.commentary}
                      </p>
                    </div>

                    {/* Weight Comparison & Alpha */}
                    <div className="flex items-center gap-6 text-sm shrink-0 flex-wrap">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Portfolio Weight</span>
                        <span className="font-black text-slate-900 text-base">{sec.portfolio_weight_pct}%</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Nifty Benchmark</span>
                        <span className="font-bold text-slate-500">{sec.benchmark_weight_pct}%</span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Est. Sector Return</span>
                        <span className="font-extrabold text-slate-800">{sec.estimated_sector_return_pct}%</span>
                      </div>

                      <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/80 text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Alpha Contrib</span>
                        <span className={`font-black text-sm ${alphaColor}`}>
                          {sec.contribution_to_alpha_pct > 0 ? `+${sec.contribution_to_alpha_pct}%` : `${sec.contribution_to_alpha_pct}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
