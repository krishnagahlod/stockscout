"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Play,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useStrategies } from "@/hooks/use-strategies";
import { useRunBacktest, useBacktestResults } from "@/hooks/use-backtest";
import { MetricsCards } from "@/components/backtest/metrics-cards";
import { EquityChart } from "@/components/backtest/equity-chart";
import { DrawdownChart } from "@/components/backtest/drawdown-chart";
import { MonthlyHeatmap } from "@/components/backtest/monthly-heatmap";
import { TradeLog } from "@/components/backtest/trade-log";
import { HoldingsTable } from "@/components/backtest/holdings-table";

import { useRouter } from "next/navigation";

export default function BacktestPage() {
  const router = useRouter();
  const { data: strategiesData } = useStrategies();
  const strategies = strategiesData?.items ?? [];
  const runBacktest = useRunBacktest();
  const { data: pastResults } = useBacktestResults();

  const [strategyId, setStrategyId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2026-07-22");
  const [capital, setCapital] = useState(1000000);
  const [frequency, setFrequency] = useState("quarterly");
  const [txCost, setTxCost] = useState(20);
  const [slippage, setSlippage] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const LOADING_MESSAGES = [
    "Fetching historical data...",
    "Applying strategy rules...",
    "Simulating trades...",
    "Computing performance metrics...",
    "Finalizing results...",
  ];
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Rotate loading messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (runBacktest.isPending) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [runBacktest.isPending]);

  const handleRun = () => {
    if (!strategyId) return;
    runBacktest.mutate(
      {
        strategy_id: Number(strategyId),
        start_date: startDate,
        end_date: endDate,
        initial_capital: capital,
        rebalance_frequency: frequency,
        tx_cost_bps: txCost,
        slippage_bps: slippage,
      },
      {
        onSuccess: (data) => {
          router.push(`/backtest/${data.id}`);
        },
      }
    );
  };

  const result = runBacktest.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Backtest</h2>
        <p className="text-muted-foreground">
          Test your strategies against historical market data
        </p>
      </div>

      {/* Config Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {strategies.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">
                No strategies to test
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Create a strategy first, then come back to backtest it.
              </p>
              <Link href="/strategies/create">
                <Button size="sm">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Create Strategy
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Primary fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Strategy
                  </label>
                  <select
                    value={strategyId}
                    onChange={(e) =>
                      setStrategyId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Select strategy...</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Capital (₹)
                  </label>
                  <Input
                    type="number"
                    value={capital}
                    onChange={(e) =>
                      setCapital(parseInt(e.target.value) || 1000000)
                    }
                    className="mt-1 h-9"
                  />
                </div>
              </div>

              {/* Advanced toggle */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? "Hide" : "Show"} advanced options
                </button>

                {showAdvanced && (
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Rebalance:
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semi_annual">Semi-Annual</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Tx Cost (bps):
                      </label>
                      <Input
                        type="number"
                        value={txCost}
                        onChange={(e) =>
                          setTxCost(parseFloat(e.target.value) || 20)
                        }
                        className="h-8 w-16 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Slippage (bps):
                      </label>
                      <Input
                        type="number"
                        value={slippage}
                        onChange={(e) =>
                          setSlippage(parseFloat(e.target.value) || 10)
                        }
                        className="h-8 w-16 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Run button */}
              <Button
                onClick={handleRun}
                disabled={!strategyId || runBacktest.isPending}
                className="w-full sm:w-auto"
              >
                {runBacktest.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Backtest
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {runBacktest.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {runBacktest.error instanceof Error
              ? runBacktest.error.message
              : "Backtest failed. Check that the strategy has valid rules and data is synced."}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
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
        </>
      )}

      {/* Past Results */}
      {!result && pastResults && pastResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Previous Backtests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastResults.map((r) => (
                <Link
                  key={r.id}
                  href={`/backtest/${r.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{r.strategy_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.start_date} → {r.end_date} · ₹
                      {r.initial_capital.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`font-mono font-bold text-sm ${
                          (r.metrics.cagr ?? 0) >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {r.metrics.cagr !== null
                          ? `${(r.metrics.cagr * 100).toFixed(1)}% CAGR`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sharpe: {r.metrics.sharpe_ratio?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
