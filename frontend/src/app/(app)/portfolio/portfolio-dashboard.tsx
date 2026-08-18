"use client";

import React, { useState, useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { SectorAllocationChart } from "./sector-allocation-chart";
import { ImportCSVModal } from "./import-csv-modal";
import { AddHoldingForm } from "./add-holding-form";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  LayoutDashboard,
  Sparkles,
  Activity,
  RefreshCw,
  PieChart,
  ArrowUpRight,
  Layers,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { PortfolioPlaybookCard } from "@/components/portfolio/portfolio-playbook-card";
import { PortfolioDriftCard } from "@/components/portfolio/portfolio-drift-card";
import { PortfolioRebalanceCard } from "@/components/portfolio/portfolio-rebalance-card";
import { CrossAccountInsightsCard } from "@/components/portfolio/cross-account-insights-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface PortfolioDashboardProps {
  userId: string;
  totalInvested: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  enrichedHoldings: any[];
  pieData: { name: string; value: number }[];
  brokerAccounts?: any[];
}

export function PortfolioDashboard({
  userId,
  totalInvested: initialTotalInvested,
  currentValue: initialCurrentValue,
  totalPnl: initialTotalPnl,
  totalPnlPct: initialTotalPnlPct,
  enrichedHoldings,
  pieData: initialPieData,
  brokerAccounts = [],
}: PortfolioDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "playbook" | "drift" | "rebalance" | "insights">("overview");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");

  // Filter holdings based on selected account
  const filteredHoldings = useMemo(() => {
    if (selectedAccount === "all") return enrichedHoldings;
    if (selectedAccount === "csv") return enrichedHoldings.filter(h => !h.broker_account_id);
    const accountId = parseInt(selectedAccount);
    return enrichedHoldings.filter(h => h.broker_account_id === accountId);
  }, [enrichedHoldings, selectedAccount]);

  // Recalculate metrics for filtered holdings
  const { totalInvested, currentValue, totalPnl, totalPnlPct, pieData } = useMemo(() => {
    if (selectedAccount === "all") {
      return { totalInvested: initialTotalInvested, currentValue: initialCurrentValue, totalPnl: initialTotalPnl, totalPnlPct: initialTotalPnlPct, pieData: initialPieData };
    }
    
    let invested = 0;
    let current = 0;
    const sectorAllocation: Record<string, number> = {};
    
    filteredHoldings.forEach(h => {
      invested += h.invested;
      current += h.current;
      const sector = h.stock.industry || "Other";
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + h.current;
    });
    
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    
    const newPieData = Object.keys(sectorAllocation)
      .map(sector => ({ name: sector, value: sectorAllocation[sector] }))
      .sort((a, b) => b.value - a.value);
      
    return { totalInvested: invested, currentValue: current, totalPnl: pnl, totalPnlPct: pnlPct, pieData: newPieData };
  }, [filteredHoldings, selectedAccount, initialTotalInvested, initialCurrentValue, initialTotalPnl, initialTotalPnlPct, initialPieData]);

  const getSourceBadge = (source: string, brokerName?: string) => {
    if (!source || source === 'csv') return <Badge variant="outline" className="text-[10px] ml-2">CSV</Badge>;
    if (brokerName === 'zerodha') return <Badge variant="outline" className="text-[10px] ml-2 bg-green-50 text-green-700 border-green-200">Zerodha</Badge>;
    if (brokerName === 'dhan') return <Badge variant="outline" className="text-[10px] ml-2 bg-blue-50 text-blue-700 border-blue-200">Dhan</Badge>;
    if (brokerName === 'groww') return <Badge variant="outline" className="text-[10px] ml-2 bg-orange-50 text-orange-700 border-orange-200">Groww</Badge>;
    return <Badge variant="outline" className="text-[10px] ml-2 capitalize">{source}</Badge>;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 text-slate-900">
      {/* Top Header & Action Options */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              Unified Command Center
            </span>
            <span className="text-[11px] font-bold text-slate-400">• Institutional Watchtower</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Portfolio Intelligence</h1>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:block">
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-[200px] border-slate-200 bg-slate-50 font-semibold h-10 shadow-2xs rounded-xl">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <span>All Accounts (Unified)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-slate-500" />
                      <span>Manual / CSV Import</span>
                    </div>
                  </SelectItem>
                  {brokerAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-indigo-600" />
                        <span className="capitalize">{acc.account_label} ({acc.broker_name})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
          <Link href="/portfolio/accounts">
            <Button variant="outline" className="bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 font-bold text-xs shadow-2xs rounded-xl h-10 px-4">
              <Wallet className="h-4 w-4 mr-2 text-indigo-600" />
              Manage Brokers
            </Button>
          </Link>
          <ImportCSVModal />
          <AddHoldingForm />
        </div>
      </div>
      
      {/* Mobile account selector */}
      <div className="block sm:hidden">
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-full border-slate-200 bg-white font-semibold h-12 shadow-sm rounded-xl">
            <SelectValue placeholder="Select Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts (Unified)</SelectItem>
            <SelectItem value="csv">Manual / CSV Import</SelectItem>
            {brokerAccounts.map(acc => (
              <SelectItem key={acc.id} value={acc.id.toString()}>
                {acc.account_label} ({acc.broker_name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Primary Top-Level Institutional Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner overflow-x-auto w-full md:w-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 ${activeTab === "overview" ? "text-indigo-600" : "text-slate-400"}`} />
          <span>Holdings & Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("playbook")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "playbook"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Sparkles className={`w-4 h-4 ${activeTab === "playbook" ? "text-indigo-600" : "text-slate-400"}`} />
          <span>AI Quant Playbook & ATR Stops</span>
        </button>

        <button
          onClick={() => setActiveTab("drift")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "drift"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Activity className={`w-4 h-4 ${activeTab === "drift" ? "text-amber-600" : "text-slate-400"}`} />
          <span>Live Drift Monitor</span>
        </button>

        <button
          onClick={() => setActiveTab("rebalance")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "rebalance"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${activeTab === "rebalance" ? "text-emerald-600" : "text-slate-400"}`} />
          <span>Rebalance & Attribution</span>
        </button>
        
        <button
          onClick={() => setActiveTab("insights")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "insights"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === "insights" ? "text-purple-600" : "text-slate-400"}`} />
          <span>Cross-Account Insights</span>
        </button>
      </div>

      {/* Tab 1: Holdings & Overview (Original upgraded to pristine light theme) */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in-50 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-16 -mt-16 z-0"></div>
              <div className="relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Total Invested</h3>
                <div className="text-3xl font-black tracking-tight text-slate-900">₹{formatNumber(totalInvested)}</div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-16 -mt-16 z-0"></div>
              <div className="relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Current Value</h3>
                <div className="text-3xl font-black tracking-tight text-slate-900">₹{formatNumber(currentValue)}</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-white to-slate-50/80 border border-slate-200 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 z-0 ${totalPnl >= 0 ? "bg-emerald-100/50" : "bg-rose-100/50"}`}></div>
              <div className="relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Overall P&L</h3>
                <div className={`flex items-baseline gap-2 ${totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  <span className="text-3xl font-black tracking-tight">
                    {totalPnl >= 0 ? "+" : ""}₹{formatNumber(totalPnl)}
                  </span>
                  <span className="text-sm font-bold bg-white/80 px-2 py-0.5 rounded-md shadow-2xs border border-slate-200/60">
                    {totalPnlPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 shadow-sm lg:col-span-2 rounded-3xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedAccount === "all" ? "All Active Holdings" : "Account Holdings"}
                </h3>
                <span className="text-xs font-bold text-slate-400">{filteredHoldings.length} stocks tracked</span>
              </div>
              <div className="p-0 flex-1">
                {filteredHoldings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <span className="text-2xl opacity-50">📊</span>
                    </div>
                    <p className="font-bold text-slate-700">No holdings found.</p>
                    <p className="text-xs text-slate-500 mt-1">Select another account or add a holding.</p>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs uppercase tracking-wider font-extrabold">
                          <th className="px-6 py-4 text-left">Stock</th>
                          <th className="px-6 py-4 text-right">Qty</th>
                          <th className="px-6 py-4 text-right">Avg Price</th>
                          <th className="px-6 py-4 text-right">LTP</th>
                          <th className="px-6 py-4 text-right">P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {filteredHoldings.map((h, i) => {
                          const broker = brokerAccounts.find(a => a.id === h.broker_account_id);
                          return (
                          <tr key={`${h.id}-${i}`} className="hover:bg-slate-50/70 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <div className="flex items-center">
                                  <span className="font-black text-slate-900 text-base group-hover:text-indigo-600 transition">
                                    {h.stock.ticker.replace(".NS", "")}
                                  </span>
                                  {selectedAccount === "all" && getSourceBadge(h.source, broker?.broker_name)}
                                </div>
                                <span className="text-xs text-slate-500 font-medium">{h.stock.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-800">{h.quantity}</td>
                            <td className="px-6 py-4 text-right text-slate-600">₹{formatNumber(h.avg_buy_price)}</td>
                            <td className="px-6 py-4 text-right font-black text-slate-900">₹{formatNumber(h.currentPrice)}</td>
                            <td className="px-6 py-4 text-right">
                              <div
                                className={`inline-flex flex-col items-end px-3 py-1 rounded-xl border shadow-2xs ${
                                  h.pnl >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                <span className="font-black">{h.pnl >= 0 ? "+" : ""}₹{formatNumber(h.pnl)}</span>
                                <span className="text-[10px] font-extrabold tracking-wider">({h.pnlPct.toFixed(2)}%)</span>
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Sector Allocation</h3>
                <PieChart className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-center">
                {filteredHoldings.length === 0 ? (
                  <div className="text-center text-slate-400 font-medium py-12">No holdings to chart</div>
                ) : (
                  <SectorAllocationChart data={pieData} currentValue={currentValue} />
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: AI Quant Playbook & Trailing Stops */}
      {activeTab === "playbook" && (
        <div className="animate-in fade-in-50 duration-300">
          <PortfolioPlaybookCard userId={userId} />
        </div>
      )}

      {/* Tab 3: Live Drift Monitor & Regime Warning */}
      {activeTab === "drift" && (
        <div className="animate-in fade-in-50 duration-300">
          <PortfolioDriftCard userId={userId} />
        </div>
      )}

      {/* Tab 4: Rebalance & Multi-Factor Attribution */}
      {activeTab === "rebalance" && (
        <div className="animate-in fade-in-50 duration-300">
          <PortfolioRebalanceCard userId={userId} />
        </div>
      )}
      
      {/* Tab 5: Cross-Account Insights */}
      {activeTab === "insights" && (
        <div className="animate-in fade-in-50 duration-300">
          <CrossAccountInsightsCard 
            playbook={null} // Usually fetched, mocking inside for demo
            holdings={enrichedHoldings.map(h => ({
              symbol: h.stock.ticker.replace('.NS', ''),
              name: h.stock.name,
              shares: h.quantity,
              weight: (h.current / currentValue),
              avg_cost: h.avg_buy_price,
              current_price: h.currentPrice,
              pnl_pct: h.pnlPct
            }))}
            isUnifiedMode={selectedAccount === "all"}
          />
        </div>
      )}
    </div>
  );
}
