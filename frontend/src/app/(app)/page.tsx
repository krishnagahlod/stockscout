"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SyncStatusCard } from "@/components/dashboard/sync-status-card";
import { MarketRegimeWidget } from "@/components/dashboard/market-regime-widget";
import { Button } from "@/components/ui/button";
import { getDashboardSummary, getRegime } from "@/lib/api";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
  TrendingUp,
  Database,
  BarChart3,
  Calculator,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    refetchInterval: 15000,
  });

  const { data: regime } = useQuery({
    queryKey: ["regime"],
    queryFn: getRegime,
    refetchInterval: 60000,
  });

  const stockCount = summary?.stock_count ?? 0;
  const withPrices = summary?.stocks_with_prices ?? 0;
  const withTechnicals = summary?.stocks_with_technicals ?? 0;
  const withFundamentals = summary?.stocks_with_fundamentals ?? 0;
  const fundamentalsLow = withFundamentals < 100 && !isLoading;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 max-w-7xl mx-auto pb-12"
    >
      {/* Hero Section */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-premium p-10 md:p-14 border-0">
        <div className="absolute top-0 right-0 -mt-32 -mr-32 w-[30rem] h-[30rem] bg-gradient-to-br from-indigo-200/40 to-purple-200/40 rounded-full blur-3xl opacity-60"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-xs font-bold mb-6 tracking-wide uppercase shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Investment Co-Pilot</span>
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 leading-[1.1]">
              Welcome back to StockScout.
            </h1>
            <p className="text-slate-500 mt-4 text-base md:text-lg leading-relaxed max-w-xl">
              Build data-driven investment strategies for Indian stocks using AI. Describe your thesis, backtest against historical data, and optimize your portfolio allocations instantly.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link href="/strategies/create">
                <Button size="lg" className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all h-14 px-8 text-base font-semibold">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Build Strategy
                </Button>
              </Link>
              <Link href="/screener">
                <Button size="lg" variant="outline" className="rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 transition-all h-14 px-8 text-base font-semibold">
                  <Calculator className="mr-2 h-5 w-5 text-slate-400" />
                  Screen Stocks
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="shrink-0">
            <MarketRegimeWidget />
          </div>
        </div>
      </motion.div>

      {/* Bento Box Grid */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Data Coverage Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            { 
              label: "Universe", 
              value: stockCount, 
              icon: Database, 
              color: "text-indigo-600", 
              bg: "bg-indigo-50",
              desc: "Total NSE/BSE Stocks"
            },
            { 
              label: "Pricing", 
              value: withPrices, 
              icon: TrendingUp, 
              color: "text-emerald-600", 
              bg: "bg-emerald-50",
              progress: stockCount ? (withPrices / stockCount) * 100 : 0,
              progressColor: "bg-emerald-500"
            },
            { 
              label: "Technicals", 
              value: withTechnicals, 
              icon: BarChart3, 
              color: "text-blue-600", 
              bg: "bg-blue-50",
              progress: stockCount ? (withTechnicals / stockCount) * 100 : 0,
              progressColor: "bg-blue-500"
            },
            { 
              label: "Fundamentals", 
              value: withFundamentals, 
              icon: fundamentalsLow ? AlertCircle : Calculator, 
              color: fundamentalsLow ? "text-amber-600" : "text-purple-600", 
              bg: fundamentalsLow ? "bg-amber-50" : "bg-purple-50",
              progress: stockCount ? (withFundamentals / stockCount) * 100 : 0,
              progressColor: fundamentalsLow ? "bg-amber-400" : "bg-purple-500"
            }
          ].map((stat, idx) => (
            <motion.div key={idx} variants={itemVariants} className="bg-white rounded-[2rem] p-6 shadow-premium hover:shadow-premium-hover transition-all flex flex-col justify-between border-0">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</span>
              </div>
              <div>
                <p className="text-4xl font-display font-bold text-slate-900 tracking-tight">
                  {isLoading ? "..." : <CountUp end={stat.value} duration={2} separator="," />}
                </p>
                {stat.progress !== undefined ? (
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.progress}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full rounded-full ${stat.progressColor}`}
                    />
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-500 mt-2">{stat.desc}</p>
                )}
              </div>
            </motion.div>
          ))}

          <motion.div variants={itemVariants} className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2rem] p-6 shadow-xl shadow-indigo-900/10 flex flex-col justify-between border-0 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                <Sparkles className="h-5 w-5 text-indigo-300" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Strategies</span>
            </div>
            <div className="relative z-10">
              <p className="text-4xl font-display font-bold tracking-tight text-white">
                {isLoading ? "..." : <CountUp end={summary?.strategy_count ?? 0} duration={1.5} />}
              </p>
              <p className="text-sm font-medium text-slate-400 mt-2">
                {summary?.backtest_count ?? 0} historical backtests
              </p>
            </div>
          </motion.div>
        </div>

        {/* Workflow Guide */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-premium border-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Zap className="h-5 w-5 text-indigo-600" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900">How It Works</h3>
          </div>
          
          <div className="space-y-4">
            {[
              { step: 1, title: "Sync Data", desc: "Load stock universe and price history", done: withPrices > 0, link: "/settings" },
              { step: 2, title: "Build Strategy", desc: "Describe your investment goal — AI creates the rules", done: (summary?.strategy_count ?? 0) > 0, link: "/strategies/create" },
              { step: 3, title: "Backtest", desc: "See how your strategy performed historically", done: (summary?.backtest_count ?? 0) > 0, link: "/backtest" },
              { step: 4, title: "Optimize Portfolio", desc: "Get exact share counts and allocation weights", done: false, link: "/portfolio" },
            ].map((item, idx) => (
              <Link
                key={item.step}
                href={item.link}
                className="group flex items-center gap-5 rounded-2xl bg-slate-50/50 p-5 hover:bg-indigo-50/50 transition-all"
              >
                <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-colors ${
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400 shadow-sm group-hover:bg-indigo-100 group-hover:text-indigo-600"
                  }`}>
                  {item.done ? <CheckCircle2 className="h-6 w-6" /> : item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{item.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-indigo-600 transition-colors shadow-sm">
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-white transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Data Sync & Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-premium border-0">
            <h3 className="text-xl font-display font-bold text-slate-900 mb-6">Pipeline Status</h3>
            <SyncStatusCard />
          </div>

          {summary?.latest_backtest && (
            <div className="bg-white rounded-[2.5rem] p-8 shadow-premium border-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-100 to-transparent opacity-50"></div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 relative z-10">Latest Backtest</h3>
              
              <div className="relative z-10">
                <p className="text-lg font-bold text-slate-900 mb-1">{summary.latest_backtest.strategy_name}</p>
                <p className="text-sm text-slate-500 mb-6">
                  {summary.latest_backtest.run_date ? new Date(summary.latest_backtest.run_date).toLocaleDateString() : ""}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-medium text-slate-500 mb-1">CAGR</p>
                    <p className={`text-xl font-display font-bold ${(summary.latest_backtest.cagr ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {((summary.latest_backtest.cagr ?? 0) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-medium text-slate-500 mb-1">Sharpe</p>
                    <p className="text-xl font-display font-bold text-slate-900">
                      {(summary.latest_backtest.sharpe ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <Link href={`/backtest/${summary.latest_backtest.id}`} className="mt-6 block w-full">
                  <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white h-12">
                    View Results
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
