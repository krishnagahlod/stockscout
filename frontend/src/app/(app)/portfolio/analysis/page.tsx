"use client";

import { useState, useEffect } from "react";
import { fetchPortfolioSnapshot, generatePortfolioReport } from "./actions";
import { HealthScoreGauge } from "./components/health-score-gauge";
import { ReportSection } from "./components/report-section";
import { CopilotChatBar } from "./components/copilot-chat-bar";
import { PerformerCard } from "./components/performer-card";
import { RegimeBadge } from "./components/regime-badge";

import { Loader2, AlertCircle, ArrowLeft, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export default function PortfolioIntelligenceHub() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await fetchPortfolioSnapshot();
      if (res.success) {
        setSnapshot(res.snapshot);
        setLoading(false); // Unblock rendering immediately!
        
        // Fire off report generation automatically in background
        setGeneratingReport(true);
        // Optimize payload size by stripping out heavy nested objects if they aren't strictly needed
        const optimizedSnapshot = {
          summary: res.snapshot.summary,
          risk_metrics: res.snapshot.risk_metrics,
          sector_allocation: res.snapshot.sector_allocation,
          regime: res.snapshot.regime,
          holdings: res.snapshot.holdings.map((h: any) => ({
            symbol: h.symbol,
            sector: h.sector,
            weight: h.weight,
            pnl_pct: h.pnl_pct,
            pe: h.fundamentals?.pe,
            beta: h.fundamentals?.beta,
            rsi_14: h.technicals?.rsi_14
          }))
        };
        
        const reportRes = await generatePortfolioReport(optimizedSnapshot);
        if (reportRes.success) {
          setReport(reportRes.report);
        }
        setGeneratingReport(false);
      } else {
        setError(res.error || "Failed to load portfolio snapshot");
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Loading Portfolio Data...</h2>
        <p className="text-slate-500">Aggregating fundamentals, technicals, and pricing.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-rose-500">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-bold">Error</h2>
        <p>{error}</p>
        <Link href="/portfolio" className="mt-4 text-indigo-500 hover:underline">Return to Portfolio</Link>
      </div>
    );
  }

  const { summary, holdings, sector_allocation, regime, risk_metrics } = snapshot;
  
  const topPerformers = [...holdings].filter(h => h.pnl_pct > 0).sort((a, b) => b.pnl_pct - a.pnl_pct).slice(0, 5);
  const bottomPerformers = [...holdings].filter(h => h.pnl_pct < 0).sort((a, b) => a.pnl_pct - b.pnl_pct).slice(0, 5);



  return (
    <div className="relative min-h-[calc(100vh-64px)] pb-32">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/portfolio" className="p-2 bg-white dark:bg-slate-900 rounded-full hover:bg-slate-50 shadow-sm border border-slate-100 dark:border-slate-800">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
              Intelligence Hub
            </h1>
            <div className="text-slate-500 font-medium flex items-center gap-2 mt-1">
              AI-Powered Portfolio Analysis
              <RegimeBadge regime={regime} />
            </div>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="col-span-1 md:col-span-1 glass-card p-6 rounded-3xl flex items-center justify-center">
            {report ? (
              <HealthScoreGauge score={report.health_score} label={report.health_label} />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2 h-full py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Analyzing Health...</span>
              </div>
            )}
          </div>
          
          <div className="col-span-1 md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-3xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 flex flex-col justify-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Total Invested</h3>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">₹{formatNumber(summary.total_invested)}</div>
            </div>
            <div className="glass-card p-6 rounded-3xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 flex flex-col justify-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Current Value</h3>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">₹{formatNumber(summary.current_value)}</div>
            </div>
            <div className={`glass-card p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 flex flex-col justify-center ${summary.total_pnl >= 0 ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : 'bg-rose-50/50 dark:bg-rose-900/20'}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Overall P&L</h3>
              <div className={`flex items-baseline gap-2 ${summary.total_pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                <span className="text-2xl font-black tracking-tight">
                  {summary.total_pnl >= 0 ? '+' : ''}₹{formatNumber(summary.total_pnl)}
                </span>
                <span className="text-sm font-bold">({summary.total_pnl_pct.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout for Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: AI Report & Charts */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                AI Health Report
              </h2>
              
              {report ? (
                <div className="space-y-4">
                  {report.sections.map((sec: any) => (
                    <ReportSection key={sec.id} section={sec} />
                  ))}
                </div>
              ) : generatingReport ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p>Our AI is analyzing your portfolio...</p>
                </div>
              ) : null}
            </div>


          </div>

          {/* Right Column: Movers & Metrics */}
          <div className="space-y-8">
            <div className="glass-card rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Top Performers
              </h3>
              <div className="space-y-3">
                {topPerformers.length > 0 ? topPerformers.map((h: any) => (
                  <PerformerCard key={h.symbol} stock={h} />
                )) : <p className="text-sm text-slate-500">No positive performers.</p>}
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                Needs Attention
              </h3>
              <div className="space-y-3">
                {bottomPerformers.length > 0 ? bottomPerformers.map((h: any) => (
                  <PerformerCard key={h.symbol} stock={h} />
                )) : <p className="text-sm text-slate-500">No negative performers.</p>}
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Risk Metrics
              </h3>
              <ul className="space-y-4">
                <li className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Concentration (Top 3)</span>
                  <span className="font-bold text-slate-900 dark:text-white">{risk_metrics.top_3_holdings_pct?.toFixed(1)}%</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Portfolio Beta</span>
                  <span className="font-bold text-slate-900 dark:text-white">{risk_metrics.avg_beta?.toFixed(2) || 'N/A'}</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Avg P/E Ratio</span>
                  <span className="font-bold text-slate-900 dark:text-white">{risk_metrics.avg_pe?.toFixed(1) || 'N/A'}</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Overbought (RSI {'>'} 70)</span>
                  <span className="font-bold text-rose-500">{risk_metrics.stocks_rsi_overbought} stocks</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <CopilotChatBar snapshotSummary={snapshot} />
    </div>
  );
}
