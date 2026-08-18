"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useSyncStatus,
  useSyncUniverse,
  useSyncPrices,
  useSyncProgress,
  useRecomputeTechnical,
  useRecomputeFundamentals,
  useSyncAll,
} from "@/hooks/use-stocks";
import { Database, RefreshCw, Download, Calculator, TrendingUp } from "lucide-react";

export function SyncStatusCard() {
  const { data: status, isLoading } = useSyncStatus();
  const syncUniverse = useSyncUniverse();
  const syncPrices = useSyncPrices();
  const recomputeTechnical = useRecomputeTechnical();
  const recomputeFundamentals = useRecomputeFundamentals();
  const syncAll = useSyncAll();

  const [trackProgress, setTrackProgress] = useState(true);
  const { data: progress } = useSyncProgress(trackProgress);

  const handleSyncPrices = () => {
    syncPrices.mutate({ limit: 10 });
    setTrackProgress(true);
  };

  const handleSyncAll = () => {
    syncAll.mutate();
    setTrackProgress(true);
  };

  useEffect(() => {
    if (progress?.completed && progress.completed > 0 && progress.is_running === false) {
      const t = setTimeout(() => setTrackProgress(false), 10000);
      return () => clearTimeout(t);
    }
  }, [progress?.is_running, progress?.completed]);

  const isSyncing = progress?.is_running ?? false;

  return (
    <Card className="shadow-sm border-slate-200 h-full">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            Backend Sync Status
          </CardTitle>
          {isSyncing && (
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse">
              Syncing...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Stocks in Universe</p>
            <p className="text-2xl font-extrabold text-slate-900">{status?.total_stocks ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Price Records</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {(status?.total_prices ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Universe Sync</span>
            <span className="font-semibold text-slate-700">
              {status?.last_universe_sync
                ? new Date(status.last_universe_sync).toLocaleString()
                : "Never"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Prices Sync</span>
            <span className="font-semibold text-slate-700">
              {status?.last_price_sync
                ? new Date(status.last_price_sync).toLocaleString()
                : "Never"}
            </span>
          </div>
        </div>

        {(isSyncing || (progress && progress.completed > 0)) && (
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-900">
                {isSyncing ? "Syncing in progress..." : "Sync complete"}
              </span>
              <span className="text-slate-500 font-medium">
                {progress?.completed ?? 0}/{progress?.total ?? 0} stocks
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${progress?.progress_pct ?? 0}%` }}
              />
            </div>
            {isSyncing && progress?.current_stock && (
              <p className="text-xs font-medium text-slate-500">
                Fetching: <span className="font-bold text-slate-700">{progress.current_stock}</span>
              </p>
            )}
            {!isSyncing && progress?.last_message && (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">{progress.last_message}</Badge>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <Button
            size="sm"
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            onClick={handleSyncAll}
            disabled={syncAll.isPending || isSyncing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sync in Progress..." : "Run Full System Refresh"}
          </Button>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs px-2"
              onClick={() => syncUniverse.mutate()}
              disabled={syncUniverse.isPending || isSyncing}
            >
              <RefreshCw className={`mr-1 h-3 w-3 text-slate-400 ${syncUniverse.isPending ? "animate-spin" : ""}`} />
              Universe
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs px-2"
              onClick={handleSyncPrices}
              disabled={syncPrices.isPending || isSyncing}
            >
              <Download className="mr-1 h-3 w-3 text-slate-400" />
              Prices
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs px-2"
              onClick={() => recomputeTechnical.mutate(10)}
              disabled={recomputeTechnical.isPending || isSyncing}
            >
              <Calculator className={`mr-1 h-3 w-3 text-slate-400 ${recomputeTechnical.isPending ? "animate-spin" : ""}`} />
              Technicals
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs px-2"
              onClick={() => recomputeFundamentals.mutate(10)}
              disabled={recomputeFundamentals.isPending || isSyncing}
            >
              <TrendingUp className={`mr-1 h-3 w-3 text-slate-400 ${recomputeFundamentals.isPending ? "animate-spin" : ""}`} />
              Fundamentals
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
