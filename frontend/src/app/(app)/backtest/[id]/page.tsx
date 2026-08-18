"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useBacktestResult } from "@/hooks/use-backtest";
import { MetricsCards } from "@/components/backtest/metrics-cards";
import { EquityChart } from "@/components/backtest/equity-chart";
import { DrawdownChart } from "@/components/backtest/drawdown-chart";
import { MonthlyHeatmap } from "@/components/backtest/monthly-heatmap";
import { TradeLog } from "@/components/backtest/trade-log";
import { HoldingsTable } from "@/components/backtest/holdings-table";

export default function BacktestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const resultId = parseInt(id);
  const { data: result, isLoading } = useBacktestResult(resultId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading backtest result...
      </div>
    );
  }

  if (!result) {
    return <p className="text-destructive p-6">Backtest result not found</p>;
  }

  const fmtPct = (v: number | null) =>
    v !== null ? `${(v * 100).toFixed(1)}%` : "--";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/backtest">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {result.strategy_name}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">
              {result.start_date} → {result.end_date}
            </span>
            <Badge variant="outline">
              ₹{result.initial_capital.toLocaleString("en-IN")} initial
            </Badge>
            <Badge variant="outline">
              ₹{result.final_value.toLocaleString("en-IN")} final
            </Badge>
          </div>
        </div>
        {/* Quick metrics in header */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">CAGR</p>
            <p
              className={`text-sm font-bold font-mono ${
                (result.metrics.cagr ?? 0) >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {fmtPct(result.metrics.cagr)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Sharpe</p>
            <p className="text-sm font-bold font-mono">
              {result.metrics.sharpe_ratio?.toFixed(2) ?? "--"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Max DD</p>
            <p className="text-sm font-bold font-mono text-red-600 dark:text-red-400">
              {fmtPct(result.metrics.max_drawdown)}
            </p>
          </div>
        </div>
      </div>

      <MetricsCards
        metrics={result.metrics}
        initialCapital={result.initial_capital}
        finalValue={result.final_value}
      />
      <EquityChart data={result.equity_curve} />
      <DrawdownChart data={result.equity_curve} />
      <MonthlyHeatmap data={result.monthly_returns} />
      <HoldingsTable holdings={result.holdings} />
      <TradeLog trades={result.trades} />
    </div>
  );
}
