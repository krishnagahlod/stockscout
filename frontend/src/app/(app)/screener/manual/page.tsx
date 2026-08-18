"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Save,
  Play,
  Loader2,
  Sparkles,
  Info,
  ArrowLeft
} from "lucide-react";
import {
  FilterBuilder,
  filtersToConditions,
  type FilterRow,
} from "@/components/screener/filter-builder";
import { ResultsTable } from "@/components/screener/results-table";
import { useMetrics, useRunScreener } from "@/hooks/use-screener";
import { useCreateStrategy } from "@/hooks/use-strategies";
import type { StrategyRules } from "@/lib/api";

export default function ManualScreenerPage() {
  const { data: metrics = [], isLoading: metricsLoading } = useMetrics();
  const screener = useRunScreener();
  const createStrategy = useCreateStrategy();

  const [strategyName, setStrategyName] = useState("My Strategy");
  const [topN, setTopN] = useState(30);
  const [rankMetric, setRankMetric] = useState("dividend_yield");
  const [rankOrder, setRankOrder] = useState("desc");
  const [filters, setFilters] = useState<FilterRow[]>([
    { id: "1", metric: "dividend_yield", op: ">", value: "3" },
    { id: "2", metric: "market_cap", op: ">", value: "5000" },
  ]);

  const buildRules = (): StrategyRules => ({
    name: strategyName,
    universe: "nifty500",
    filters: filtersToConditions(filters),
    ranking: { metric: rankMetric, order: rankOrder },
    selection: { top_n: topN },
  });

  const handleRun = () => {
    screener.mutate(buildRules());
  };

  const handleSave = () => {
    const rules = buildRules();
    createStrategy.mutate({
      name: strategyName,
      description: `Screener: ${rules.filters
        .map((f) => `${f.metric} ${f.op} ${f.value}`)
        .join(", ")}`,
      rules_json: JSON.stringify(rules),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/screener">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manual Screener</h2>
          <p className="text-muted-foreground">
            Filter and rank stocks using custom rules
          </p>
        </div>
        <div className="ml-auto">
          <Link href="/strategies/create">
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              AI Builder
            </Button>
          </Link>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Use 2-3 filters for best results. Percentage
          metrics (dividend yield, ROE, margins) should be entered as whole
          numbers (e.g. 3 for 3%). Market cap is in crores.
        </p>
      </div>

      {/* Filter Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading metrics...
            </div>
          ) : (
            <FilterBuilder
              metrics={metrics}
              filters={filters}
              onChange={setFilters}
            />
          )}

          {/* Ranking & Selection */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Rank by:
              </label>
              <select
                value={rankMetric}
                onChange={(e) => setRankMetric(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                {metrics.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={rankOrder}
                onChange={(e) => setRankOrder(e.target.value)}
                className="h-8 w-20 rounded-md border bg-background px-2 text-xs"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Top N:
              </label>
              <Input
                type="number"
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value) || 30)}
                className="h-8 w-16 text-xs"
              />
            </div>
          </div>

          {/* Strategy name + actions */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
            <Input
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="Strategy name"
              className="h-9 max-w-60"
            />
            <Button
              onClick={handleRun}
              disabled={screener.isPending || filters.length === 0}
            >
              {screener.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {screener.isPending ? "Running..." : "Run Screener"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={createStrategy.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Save as Strategy
            </Button>
            {createStrategy.isSuccess && (
              <Badge variant="default">Saved!</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {screener.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {screener.error instanceof Error
              ? screener.error.message
              : "Screener failed. Make sure data is synced in Settings."}
          </p>
        </div>
      )}

      {/* Results */}
      {screener.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>
                Results: {screener.data.strategy_name}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {screener.data.filtered_count} stocks matched out of{" "}
                {screener.data.total_universe}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {screener.data.filtered_count === 0 ? (
              <div className="text-center py-8">
                <Search className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">No stocks match</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Try relaxing your filters (lower thresholds, fewer conditions)
                  or sync more data in Settings.
                </p>
              </div>
            ) : (
              <ResultsTable data={screener.data} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
