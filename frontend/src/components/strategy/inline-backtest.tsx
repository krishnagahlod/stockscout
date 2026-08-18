"use client";

import { useState } from "react";
import {
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useRunBacktest } from "@/hooks/use-backtest";
import type { BacktestResponse } from "@/lib/api";
import Link from "next/link";

interface InlineBacktestProps {
  strategyId: number;
}

function fmt(val: number | null, style: "pct" | "inr" = "pct"): string {
  if (val === null || val === undefined) return "--";
  if (style === "pct") return `${(val * 100).toFixed(1)}%`;
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const LOADING_MESSAGES = [
  "Fetching historical market data...",
  "Applying strategy rules...",
  "Simulating trades...",
  "Calculating performance metrics...",
  "Generating equity curve..."
];

export function InlineBacktest({ strategyId }: InlineBacktestProps) {
  const router = useRouter();
  const backtest = useRunBacktest();
  const [sl, setSl] = useState<string>("");
  const [tp, setTp] = useState<string>("");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (backtest.isPending) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 5000); // Change message every 5 seconds
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [backtest.isPending]);

  const handleRun = () => {
    backtest.mutate(
      {
        strategy_id: strategyId,
        start_date: "2020-01-01",
        initial_capital: 1000000,
        rebalance_frequency: "quarterly",
        tx_cost_bps: 20,
        stop_loss_pct: sl ? parseFloat(sl) / 100 : undefined,
        take_profit_pct: tp ? parseFloat(tp) / 100 : undefined,
      },
      {
        onSuccess: (data) => {
          // Auto-navigate to the detailed backtest page on success
          router.push(`/backtest/${data.id}`);
        },
      }
    );
  };

  if (!backtest.isPending && !backtest.isError) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs">
          <input
            type="number"
            placeholder="Stop Loss % (e.g. 8)"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            className="w-32 rounded-md border bg-background px-2 py-1"
          />
          <input
            type="number"
            placeholder="Take Profit % (e.g. 20)"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className="w-32 rounded-md border bg-background px-2 py-1"
          />
        </div>
        <Button onClick={handleRun} variant="outline" size="sm" className="gap-2 w-fit">
          <Play className="h-3.5 w-3.5" />
          Quick Backtest (5Y, ₹10L)
        </Button>
      </div>
    );
  }

  if (backtest.isPending) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3 transition-all">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="animate-pulse">{LOADING_MESSAGES[loadingMsgIdx]}</span>
        </div>
        <p className="text-xs text-muted-foreground ml-7">
          Testing your strategy from 2020 with ₹10L capital. This usually takes about 30-40 seconds.
        </p>
      </div>
    );
  }

  if (backtest.isError) {
    return (
      <div className="rounded-lg border border-destructive/50 p-3">
        <p className="text-sm text-destructive">
          Backtest failed. Make sure price data is synced.
        </p>
        <Button
          onClick={handleRun}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Once result is present, the router is pushing to the new page.
  // We return null to avoid flashing the old inline UI during transition.
  return null;
}
