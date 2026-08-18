"use client";

import { useState } from "react";
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Calendar, 
  Compass, 
  ChevronRight, 
  ChevronDown,
  AlertCircle,
  BarChart3,
  Target,
  Bell,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StrategyPlaybook, StockPlaybookGuidance } from "@/lib/api";
import Link from "next/link";

interface PlaybookViewProps {
  playbook: StrategyPlaybook | null;
  isLoading?: boolean;
}

const SIGNAL_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  BULLISH_ENTRY: { label: "Bullish Entry Zone", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-500 dark:text-emerald-400" },
  HOLD_TREND: { label: "Hold Trend", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-600 dark:text-blue-400" },
  WAIT_PULLBACK: { label: "Wait For Pullback", bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-600 dark:text-amber-400" },
  NEUTRAL: { label: "Neutral Signal", bg: "bg-gray-500/15 border-gray-500/30", text: "text-gray-600 dark:text-gray-400" },
};

const REGIME_COLORS: Record<string, string> = {
  BULL: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-500/20",
  BEAR: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-500/20",
  SIDEWAYS: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-500/20",
  HIGH_VOLATILITY: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-500/20",
};

export function PlaybookView({ playbook, isLoading }: PlaybookViewProps) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 p-8 border border-dashed rounded-xl bg-card/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Generating Comprehensive Quantitative Strategy Playbook...
        </p>
        <p className="text-xs text-muted-foreground/80 max-w-sm text-center">
          Synthesizing live VIX, market regime rotation, ATR-14 volatility boundaries, and recent news catalysts.
        </p>
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="p-8 text-center border rounded-xl bg-muted/20 text-muted-foreground text-sm">
        No playbook generated yet. Finalize or save your strategy to generate actionable pre-flight guidance.
      </div>
    );
  }

  const toggleExpand = (symbol: string) => {
    setExpandedSymbol(expandedSymbol === symbol ? null : symbol);
  };

  const regime = playbook.macro_context?.regime.toUpperCase() || "NORMAL";
  const vix = playbook.macro_context?.vix ?? 14.2;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* 1. Macro Context & Strategy Overview Header Card */}
      <div className="p-6 rounded-2xl border bg-gradient-to-br from-card via-card/90 to-blue-500/5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary animate-spin-slow" />
              <h3 className="text-lg font-semibold tracking-tight">Executive Strategy Playbook</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Generated on {new Date(playbook.generated_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Market Regime:</span>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${REGIME_COLORS[regime] || REGIME_COLORS["SIDEWAYS"]}`}>
              {regime}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-secondary text-secondary-foreground border">
              India VIX: {vix}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-muted/30 border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Macro Outlook</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
              {playbook.market_outlook || playbook.macro_context?.macro_summary}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-500 dark:text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Risk Budget & Sizing</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
              {playbook.overall_risk_budget}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-500 dark:text-blue-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Rebalance Guidance</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-4">
              {playbook.rebalance_schedule_guidance}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Sector Allocation & Rotation Banner */}
      {playbook.sector_allocation_rationale && (
        <div className="p-4 rounded-xl border bg-card/60 flex items-start gap-3 text-sm">
          <Target className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Sector Rotation Strategy</h4>
            <p className="text-muted-foreground text-xs leading-relaxed">{playbook.sector_allocation_rationale}</p>
          </div>
        </div>
      )}

      {/* 3. Actionable Stock Guidance Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Selected Holdings & Execution Playbook ({playbook.stock_guidance.length})
          </h3>
          <span className="text-xs text-muted-foreground">Click card to expand deep rationale</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {playbook.stock_guidance.map((stock: StockPlaybookGuidance) => {
            const style = SIGNAL_STYLES[stock.technical_signal_status] || SIGNAL_STYLES["NEUTRAL"];
            const isExpanded = expandedSymbol === stock.symbol;

            return (
              <div 
                key={stock.symbol}
                className="rounded-xl border bg-card transition-all duration-200 overflow-hidden shadow-sm hover:border-border/80"
              >
                {/* Header Row */}
                <div 
                  onClick={() => toggleExpand(stock.symbol)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-muted/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                      {stock.symbol.slice(0, 4)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">{stock.symbol.replace('.NS', '')}</span>
                        <span className="text-muted-foreground text-xs font-normal max-w-[160px] md:max-w-[240px] truncate">
                          {stock.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {stock.sector || "Equity"}
                        </Badge>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-right shrink-0 bg-muted/20 px-3 py-2 rounded-lg border border-border/40">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Current</div>
                      <div className="text-xs font-bold text-foreground">₹{stock.current_price}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Entry Zone</div>
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{stock.entry_zone_low} - ₹{stock.entry_zone_high}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">ATR Stop Loss</div>
                      <div className="text-xs font-bold text-rose-500">
                        ₹{stock.initial_stop_loss} ({stock.stop_distance_pct}%)
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center text-muted-foreground pr-1">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="p-4 bg-muted/10 border-t border-border/50 grid grid-cols-1 gap-6 text-xs">
                    {/* Visual Price Ladder */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" /> 
                          Execution Ladder & Profit Targets
                        </span>
                        {stock.risk_reward_ratio > 0 && (
                          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                            Avg R:R {stock.risk_reward_ratio}x
                          </Badge>
                        )}
                      </div>
                      
                      <div className="rounded-xl border bg-card p-4 overflow-hidden relative">
                        {/* Connecting Line */}
                        <div className="absolute left-6 top-8 bottom-8 w-px bg-border/60 border-l border-dashed z-0"></div>
                        
                        <div className="space-y-4 relative z-10">
                          {stock.profit_targets && stock.profit_targets.length > 0 ? (
                            [...stock.profit_targets].reverse().map((pt, i) => {
                              const taxSt = stock.tax_impact_short_term?.[stock.profit_targets.length - 1 - i];
                              const taxLt = stock.tax_impact_long_term?.[stock.profit_targets.length - 1 - i];
                              
                              return (
                                <div key={pt.level} className="flex flex-col sm:flex-row sm:items-center gap-3">
                                  <div className="flex items-center gap-3 w-full sm:w-2/5">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 border-4 border-card shadow-sm shrink-0 z-10" />
                                    <div className="flex-1 flex items-center justify-between">
                                      <span className="font-bold text-foreground">₹{pt.price.toLocaleString()}</span>
                                      <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        {pt.level}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="flex-1 pl-7 sm:pl-0 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">+{pt.gain_pct}%</span>
                                      <span className="text-muted-foreground text-[10px]">Sell {pt.exit_pct * 100}%</span>
                                    </div>
                                    
                                    <div className="flex gap-4 text-[10px]">
                                      <div className="flex flex-col">
                                        <span className="text-muted-foreground/80">STCG Net</span>
                                        <span className="font-medium text-foreground">+{taxSt?.net_gain_pct}%</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-muted-foreground/80">LTCG Net</span>
                                        <span className="font-medium text-foreground">+{taxLt?.net_gain_pct}%</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-center gap-3 opacity-50">
                              <div className="w-4 h-4 rounded-full bg-emerald-500 border-4 border-card shrink-0 z-10" />
                              <span className="text-muted-foreground">Target: ₹{stock.take_profit_target}</span>
                            </div>
                          )}

                          {/* Entry Line */}
                          <div className="flex items-center gap-3 py-1">
                            <div className="w-4 h-4 rounded-full bg-blue-500 border-4 border-card shadow-sm shrink-0 z-10" />
                            <div className="flex-1 flex items-center justify-between border-b border-dashed pb-1">
                              <span className="font-bold text-foreground">₹{stock.current_price}</span>
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 tracking-wider">ENTRY PRICE</span>
                            </div>
                          </div>

                          {/* Stop Loss Line */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 w-full sm:w-2/5">
                              <div className="w-4 h-4 rounded-full bg-rose-500 border-4 border-card shadow-sm shrink-0 z-10" />
                              <div className="flex-1 flex items-center justify-between">
                                <span className="font-bold text-foreground">₹{stock.initial_stop_loss}</span>
                                <Badge variant="secondary" className="text-[10px] bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300">
                                  STOP LOSS
                                </Badge>
                              </div>
                            </div>
                            <div className="flex-1 pl-7 sm:pl-0 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-rose-600 dark:text-rose-400 font-semibold text-xs">-{stock.stop_distance_pct}%</span>
                                <span className="text-muted-foreground text-[10px]">Exit 100%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {stock.breakeven_after_tax_pct > 0 && (
                          <div className="mt-4 pt-3 border-t flex items-center gap-2 text-[10px] text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Breakeven after STCG tax + costs: <strong className="text-foreground">+{stock.breakeven_after_tax_pct}%</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rationales & Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-4">
                        <div>
                          <span className="font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                            <Target className="w-3.5 h-3.5 text-indigo-500" /> Target Methodology
                          </span>
                          <p className="text-muted-foreground leading-relaxed mb-2">{stock.target_reasoning_summary}</p>
                          {stock.profit_targets && stock.profit_targets.length > 0 && (
                            <ul className="space-y-1.5 text-muted-foreground/90">
                              {stock.profit_targets.map(pt => (
                                <li key={pt.level} className="flex gap-2">
                                  <span className="font-medium text-foreground shrink-0">{pt.level.split(' ')[0]}:</span> 
                                  <span>{pt.rationale}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div>
                          <span className="font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Stop Loss Discipline
                          </span>
                          <p className="text-muted-foreground leading-relaxed">{stock.stop_loss_rationale}</p>
                          <div className="mt-1.5 text-[11px] px-2.5 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium border border-rose-500/20 inline-block">
                            {stock.trailing_stop_rule}
                          </div>
                        </div>
                      </div>

                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-foreground block mb-1">📰 Recent News Catalysts:</span>
                        <p className="text-muted-foreground leading-relaxed">{stock.news_catalysts}</p>
                      </div>

                      <div>
                        <span className="font-semibold text-foreground block mb-1">📊 Key Metrics & Regime Behavior:</span>
                        <p className="text-muted-foreground leading-relaxed">{stock.regime_behavior}</p>
                        {stock.key_metrics_to_watch && stock.key_metrics_to_watch.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {stock.key_metrics_to_watch.map((m, i) => (
                              <span key={i} className="bg-background border rounded px-2 py-0.5 text-[10px] text-muted-foreground">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Link 
                          href={`/stocks/${stock.symbol}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          View stock deep dive <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Near-Miss Watchlist Candidates */}
      {playbook.watchlist && playbook.watchlist.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            Radar & Near-Miss Watchlist ({playbook.watchlist.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {playbook.watchlist.map((cand) => (
              <div key={cand.symbol} className="p-3.5 rounded-xl border bg-muted/20 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{cand.symbol.replace('.NS', '')}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{cand.sector || "Equity"}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate font-medium mt-0.5">{cand.name}</div>
                </div>
                <p className="text-[10px] text-muted-foreground/80 leading-normal line-clamp-3">
                  {cand.reason_near_miss}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
