"use client";

import { useQuery } from "@tanstack/react-query";
import { getRegime } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function MarketRegimeWidget() {
  const { data: regimeData, isLoading, isError } = useQuery({
    queryKey: ["market-regime"],
    queryFn: getRegime,
    refetchInterval: 1000 * 60 * 15, // Refetch every 15 mins
  });

  if (isLoading) {
    return (
      <Card className="shadow-sm border-slate-200/60 bg-white">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !regimeData) {
    return (
      <Card className="shadow-sm border-red-100 bg-red-50/50">
        <CardContent className="p-6 flex items-center gap-4 text-red-600">
          <AlertTriangle className="h-8 w-8" />
          <div>
            <h3 className="font-semibold">Unable to determine Market Regime</h3>
            <p className="text-sm text-red-500">Could not fetch Nifty 500 trend data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { regime, nifty_close, sma_200 } = regimeData;

  const regimeConfig = {
    bull: {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
      icon: TrendingUp,
      title: "Bull Market",
      desc: "Nifty 500 is trading above its long-term moving averages.",
    },
    bear: {
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200",
      badge: "bg-rose-100 text-rose-700 hover:bg-rose-100",
      icon: TrendingDown,
      title: "Bear Market",
      desc: "Nifty 500 is trading below its long-term moving averages.",
    },
    sideways: {
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      icon: Minus,
      title: "Sideways / Choppy",
      desc: "Mixed signals from moving averages indicating consolidation.",
    },
    unknown: {
      color: "text-slate-500",
      bg: "bg-slate-50",
      border: "border-slate-200",
      badge: "bg-slate-100 text-slate-700 hover:bg-slate-100",
      icon: Activity,
      title: "Unknown Regime",
      desc: "Insufficient data to determine market regime.",
    },
  };

  const config = regimeConfig[regime as keyof typeof regimeConfig] || regimeConfig.unknown;
  const Icon = config.icon;

  return (
    <Card className={`shadow-sm border transition-all ${config.border} ${config.bg} bg-opacity-30`}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full bg-white shadow-sm border ${config.border} ${config.color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`text-lg font-bold tracking-tight ${config.color}`}>
                  Market Context
                </h3>
                <Badge variant="outline" className={`font-semibold ${config.badge} border-0`}>
                  {config.title}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 font-medium">
                {config.desc}
              </p>
            </div>
          </div>
          
          {(nifty_close && sma_200) ? (
            <div className="flex items-center gap-6 bg-white/60 p-3 rounded-lg border border-slate-200/60 shadow-sm backdrop-blur-sm">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">NIFTY 500</p>
                <p className="text-lg font-bold text-slate-800">{nifty_close.toFixed(2)}</p>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">200 SMA</p>
                <p className="text-lg font-bold text-slate-800">{sma_200.toFixed(2)}</p>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
