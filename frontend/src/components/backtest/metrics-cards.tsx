"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { BacktestMetrics } from "@/lib/api";

interface MetricsCardsProps {
  metrics: BacktestMetrics;
  initialCapital: number;
  finalValue: number;
}

function fmt(val: number | null, style: "pct" | "num" | "inr" = "num", decimals = 2): string {
  if (val === null || val === undefined) return "—";
  if (style === "pct") return `${(val * 100).toFixed(decimals)}%`;
  if (style === "inr") return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return val.toFixed(decimals);
}

export function MetricsCards({ metrics, initialCapital, finalValue }: MetricsCardsProps) {
  const primaryCards = [
    { 
      label: "Final Value", 
      value: fmt(finalValue, "inr"), 
      sub: `from ${fmt(initialCapital, "inr")}`,
      tooltip: "The total value of your portfolio at the end of the backtest period."
    },
    { 
      label: "CAGR", 
      value: fmt(metrics.cagr, "pct"), 
      color: (metrics.cagr ?? 0) >= 0,
      tooltip: "Compound Annual Growth Rate: The average yearly percentage growth of your money." 
    },
    { 
      label: "Total Return", 
      value: fmt(metrics.total_return, "pct"), 
      color: (metrics.total_return ?? 0) >= 0,
      tooltip: "The total percentage profit or loss generated over the entire period."
    },
    { 
      label: "Max Drawdown", 
      value: fmt(metrics.max_drawdown, "pct"), 
      color: false,
      tooltip: "The biggest drop in your portfolio value from its peak to its lowest point. This shows the worst-case scenario you would have experienced."
    },
    { 
      label: "Win Rate", 
      value: fmt(metrics.win_rate, "pct"),
      tooltip: "The percentage of trades that made a profit compared to trades that lost money. Above 50% means you win more often than you lose."
    },
  ];

  const advancedCards = [
    { label: "Sharpe Ratio", value: fmt(metrics.sharpe_ratio), color: (metrics.sharpe_ratio ?? 0) >= 1, tooltip: "Measures return compared to risk. A score above 1.0 is good, and above 2.0 is excellent." },
    { label: "Sortino Ratio", value: fmt(metrics.sortino_ratio), tooltip: "Similar to Sharpe, but only penalizes harmful (downward) volatility." },
    { label: "Calmar Ratio", value: fmt(metrics.calmar_ratio), tooltip: "Measures the return compared to the maximum drawdown risk." },
    { label: "Volatility", value: fmt(metrics.volatility, "pct"), tooltip: "How wildly the portfolio's value swings up and down. Lower is generally safer." },
    { label: "Alpha", value: fmt(metrics.alpha, "pct"), color: (metrics.alpha ?? 0) >= 0, tooltip: "How much better the strategy performed compared to the overall market benchmark. Positive is good." },
    { label: "Buy & Hold CAGR", value: fmt(metrics.benchmark_cagr, "pct"), tooltip: "The average yearly growth if you had just bought the Day 1 strategy portfolio and held it without rebalancing." },
    { label: "Total Trades", value: String(metrics.total_trades), tooltip: "The total number of buy and sell transactions executed." },
  ];

  const renderCard = (card: any, isPrimary: boolean) => (
    <Card key={card.label} className={isPrimary ? "shadow-sm" : "bg-muted/30 shadow-none border-dashed"}>
      <CardContent className={isPrimary ? "p-5" : "p-3"}>
        <div className="flex items-center gap-1.5 mb-1">
          <p className={`${isPrimary ? "text-sm font-medium" : "text-xs"} text-muted-foreground`}>
            {card.label}
          </p>
          {card.tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px] text-center">
                <p>{card.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p
          className={`${isPrimary ? "text-2xl" : "text-base"} font-bold font-mono ${
            card.color === true
              ? "text-green-600 dark:text-green-400"
              : card.color === false
              ? "text-red-600 dark:text-red-400"
              : ""
          }`}
        >
          {card.value}
        </p>
        {card.sub && (
          <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {primaryCards.map(c => renderCard(c, true))}
      </div>

      {/* Advanced Metrics */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Advanced Metrics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {advancedCards.map(c => renderCard(c, false))}
        </div>
      </div>
    </div>
  );
}
