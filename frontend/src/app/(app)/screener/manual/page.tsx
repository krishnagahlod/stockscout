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
  ArrowLeft,
  Download,
  Flame,
  ShieldCheck,
  Coins,
  TrendingUp,
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

const PRESETS = [
  {
    name: "Magic Formula",
    icon: Flame,
    desc: "High return on capital with attractive valuation",
    rankMetric: "pe",
    rankOrder: "asc",
    filters: [
      { id: "1", metric: "pe", op: "<", value: "25" },
      { id: "2", metric: "roe", op: ">", value: "18" },
      { id: "3", metric: "market_cap", op: ">", value: "2000" },
    ],
  },
  {
    name: "Debt-Free Compounders",
    icon: ShieldCheck,
    desc: "Virtually zero debt and high return on equity",
    rankMetric: "roe",
    rankOrder: "desc",
    filters: [
      { id: "1", metric: "debt_to_equity", op: "<", value: "0.2" },
      { id: "2", metric: "roe", op: ">", value: "15" },
      { id: "3", metric: "market_cap", op: ">", value: "5000" },
    ],
  },
  {
    name: "Dividend Aristocrats",
    icon: Coins,
    desc: "Cash-rich firms with steady, high dividend payouts",
    rankMetric: "dividend_yield",
    rankOrder: "desc",
    filters: [
      { id: "1", metric: "dividend_yield", op: ">", value: "2.5" },
      { id: "2", metric: "debt_to_equity", op: "<", value: "0.8" },
      { id: "3", metric: "market_cap", op: ">", value: "3000" },
    ],
  },
  {
    name: "Quality Growth",
    icon: TrendingUp,
    desc: "Strong operating margins and large cap stability",
    rankMetric: "market_cap",
    rankOrder: "desc",
    filters: [
      { id: "1", metric: "operating_margin", op: ">", value: "18" },
      { id: "2", metric: "roe", op: ">", value: "14" },
      { id: "3", metric: "market_cap", op: ">", value: "15000" },
    ],
  },
];

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

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setStrategyName(preset.name);
    setRankMetric(preset.rankMetric);
    setRankOrder(preset.rankOrder);
    setFilters(preset.filters);
    screener.mutate({
      name: preset.name,
      universe: "nifty500",
      filters: filtersToConditions(preset.filters),
      ranking: { metric: preset.rankMetric, order: preset.rankOrder },
      selection: { top_n: topN },
    });
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

  const handleExportCSV = () => {
    if (!screener.data?.stocks || screener.data.stocks.length === 0) return;
    const items = screener.data.stocks;
    const headers = ["Symbol", "Name", "Sector", "Market Cap (Cr)", "P/E", "P/B", "ROE %", "Div Yield %"];
    const rows = items.map((s: any) => [
      s.symbol,
      `"${s.name || ""}"`,
      `"${s.sector || ""}"`,
      s.market_cap || "",
      s.pe || "",
      s.pb || "",
      s.roe || "",
      s.dividend_yield || "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${strategyName.replace(/\s+/g, "_")}_screen.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/screener">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quantitative Stock Screener</h2>
          <p className="text-muted-foreground text-sm">
            Institutional multi-factor filtering & custom screen presets
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {screener.data?.stocks && screener.data.stocks.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="rounded-xl">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
          <Link href="/strategies/create">
            <Button variant="outline" size="sm" className="rounded-xl border-indigo-200 text-indigo-700 bg-indigo-50/50">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI Strategy Builder
            </Button>
          </Link>
        </div>
      </div>

      {/* Preset Strategy Screens (Screener.in style) */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Popular Preset Screens
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = strategyName === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`text-left p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs"
                    : "border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white mb-1">
                  <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{p.name}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Configuration */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Search className="h-4 w-4 text-indigo-600" />
            Custom Filter Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading metrics catalog...
            </div>
          ) : (
            <FilterBuilder
              metrics={metrics}
              filters={filters}
              onChange={setFilters}
            />
          )}

          {/* Ranking & Selection Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Strategy Name
              </label>
              <Input
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="My Strategy"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Rank By
              </label>
              <div className="flex gap-1.5">
                <select
                  value={rankMetric}
                  onChange={(e) => setRankMetric(e.target.value)}
                  className="flex-1 h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="market_cap">Market Cap</option>
                  <option value="pe">P/E Ratio</option>
                  <option value="pb">P/B Ratio</option>
                  <option value="roe">ROE</option>
                  <option value="roce">ROCE</option>
                  <option value="dividend_yield">Dividend Yield</option>
                  <option value="debt_to_equity">Debt to Equity</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRankOrder(rankOrder === "asc" ? "desc" : "asc")}
                  className="h-9 px-2 text-xs rounded-xl"
                >
                  {rankOrder.toUpperCase()}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Max Results
              </label>
              <Input
                type="number"
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value) || 20)}
                className="h-9 text-xs rounded-xl"
                min={5}
                max={100}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRun}
                disabled={screener.isPending}
                className="rounded-xl px-5"
              >
                {screener.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4 fill-current" />
                )}
                Run Screener
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={createStrategy.isPending}
                className="rounded-xl"
              >
                {createStrategy.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Strategy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Screener Results Table */}
      {screener.data && (
        <ResultsTable data={screener.data} />
      )}
    </div>
  );
}
