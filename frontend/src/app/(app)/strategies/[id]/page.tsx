"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Sparkles,
  Loader2,
  ExternalLink,
  BarChart3,
  List,
  Brain,
  PieChart,
  Activity,
  Sliders,
} from "lucide-react";
import Link from "next/link";
import { useStrategy } from "@/hooks/use-strategies";
import { useExplainRules, useGenerateThesis, useGetStrategyPlaybook } from "@/hooks/use-llm";
import { useRunScreener } from "@/hooks/use-screener";
import { useBacktestResults } from "@/hooks/use-backtest";
import { PlainEnglishRules } from "@/components/strategy/plain-english-rules";
import { ThesisPanel } from "@/components/strategy/thesis-panel";
import { StockExplainCard } from "@/components/strategy/stock-explain-card";
import { InlineBacktest } from "@/components/strategy/inline-backtest";
import { PlaybookView } from "@/components/strategy/playbook-view";
import { DriftMonitorCard } from "@/components/strategy/drift-monitor-card";
import { RebalanceExecutionCard } from "@/components/strategy/rebalance-execution-card";
import { AlertPanel } from "@/components/alerts/alert-panel";
import { ResultsTable } from "@/components/screener/results-table";


import type {
  StrategyRules,
  ExplainRulesResponse,
  InvestmentThesis,
} from "@/lib/api";

type TabId = "overview" | "playbook" | "monitor" | "rebalance" | "stocks" | "backtest";



export default function StrategyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const strategyId = parseInt(id);
  const router = useRouter();
  const { data: strategy, isLoading } = useStrategy(strategyId);
  const backtestResults = useBacktestResults(strategyId);
  const screener = useRunScreener();
  const explainRulesMutation = useExplainRules();
  const thesisMutation = useGenerateThesis();

  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const tabQuery = searchParams.get("tab") as TabId;
    if (tabQuery && tabQuery !== activeTab) {
      setActiveTab(tabQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: playbookData, isLoading: playbookLoading } = useGetStrategyPlaybook(strategyId, activeTab === "playbook");

  const [rulesExplanation, setRulesExplanation] =
    useState<ExplainRulesResponse | null>(null);

  const [thesis, setThesis] = useState<InvestmentThesis | null>(null);
  const [parsedRules, setParsedRules] = useState<StrategyRules | null>(null);
  const [stocksLoaded, setStocksLoaded] = useState(false);

  // Parse rules when strategy loads
  useEffect(() => {
    if (strategy?.rules_json) {
      try {
        const rules = typeof strategy.rules_json === 'string' 
          ? JSON.parse(strategy.rules_json) as StrategyRules 
          : strategy.rules_json as StrategyRules;
        setParsedRules(rules);

        // Auto-load overview data
        explainRulesMutation.mutate(rules, {
          onSuccess: (data) => setRulesExplanation(data),
        });
        thesisMutation.mutate(strategyId, {
          onSuccess: (data) => setThesis(data),
        });
      } catch {
        // invalid JSON
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.rules_json, strategyId]);

  // Load stocks when tab is clicked
  useEffect(() => {
    if (activeTab === "stocks" && parsedRules && !stocksLoaded) {
      screener.mutate(parsedRules);
      setStocksLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, parsedRules]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading strategy...
      </div>
    );
  }

  if (!strategy) {
    return <p className="text-destructive p-6">Strategy not found</p>;
  }

  const latestBacktest =
    backtestResults.data && backtestResults.data.length > 0
      ? backtestResults.data[0]
      : null;

  const TABS: { id: TabId; label: string; icon: typeof Brain }[] = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "playbook", label: "AI Playbook", icon: Sparkles },
    { id: "monitor", label: "Live Monitor & Drift", icon: Activity },
    { id: "rebalance", label: "Rebalance & Attribution", icon: Sliders },
    { id: "stocks", label: "Stocks", icon: List },
    { id: "backtest", label: "Backtest", icon: BarChart3 },
  ];




  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/strategies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {strategy.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {strategy.description || "No description"}
          </p>
        </div>
        <Badge>{strategy.status}</Badge>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {parsedRules?.strategy_type === "custom" ? (
          <Link href={`/strategies/create?type=custom&edit=${strategyId}`}>
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Edit Custom Strategy
            </Button>
          </Link>
        ) : (
          <Link href={`/strategies/create`}>
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Edit in AI Chat
            </Button>
          </Link>
        )}
        <Link href="/portfolio">
          <Button variant="outline" size="sm">
            <PieChart className="mr-2 h-4 w-4" />
            Optimize Portfolio
          </Button>
        </Link>
      </div>

      <AlertPanel strategyId={strategyId} />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plain English Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Strategy Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <PlainEnglishRules
                explanation={rulesExplanation}
                isLoading={explainRulesMutation.isPending}
              />
              {!rulesExplanation &&
                !explainRulesMutation.isPending &&
                parsedRules && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {parsedRules.filters.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {f.metric} {f.op} {String(f.value)}
                        </Badge>
                      ))}
                    </div>
                    {parsedRules.ranking && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Ranked by {parsedRules.ranking.metric || "composite"} (
                        {parsedRules.ranking.order || "desc"})
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Position Sizing: {parsedRules.position_sizing === "inverse_volatility" ? "Risk-Adjusted (Inverse Volatility)" : "Equal Weighting"}
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Investment Thesis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Investment Thesis</CardTitle>
            </CardHeader>
            <CardContent>
              <ThesisPanel
                thesis={thesis}
                isLoading={thesisMutation.isPending}
              />
            </CardContent>
          </Card>

          {/* Quick stats */}
          {latestBacktest && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Latest Backtest</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: "CAGR",
                      value: latestBacktest.metrics.cagr,
                      fmt: "pct",
                    },
                    {
                      label: "Sharpe",
                      value: latestBacktest.metrics.sharpe_ratio,
                      fmt: "num",
                    },
                    {
                      label: "Max Drawdown",
                      value: latestBacktest.metrics.max_drawdown,
                      fmt: "pct",
                    },
                    {
                      label: "Total Return",
                      value: latestBacktest.metrics.total_return,
                      fmt: "pct",
                    },
                  ].map((m) => (
                    <div key={m.label} className="rounded-md border px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">
                        {m.label}
                      </p>
                      <p className="text-sm font-semibold">
                        {m.value !== null && m.value !== undefined
                          ? m.fmt === "pct"
                            ? `${(m.value * 100).toFixed(1)}%`
                            : m.value.toFixed(2)
                          : "--"}
                      </p>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/backtest/${latestBacktest.id}`}
                  className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
                >
                  View Full Report <ExternalLink className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Original prompt */}
          {strategy.user_prompt && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Original Request</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm italic text-muted-foreground">
                  &quot;{strategy.user_prompt}&quot;
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "stocks" && (
        <div className="space-y-4">
          {screener.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Screening stocks...
            </div>
          )}

          {screener.data && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {screener.data.filtered_count} stocks match out of{" "}
                  {screener.data.total_universe}
                </p>
              </div>

              <ResultsTable data={screener.data} />
            </>
          )}

          {screener.isError && (
            <p className="text-sm text-destructive">
              Failed to screen stocks. Ensure data is synced.
            </p>
          )}
        </div>
      )}

      {activeTab === "backtest" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Run Backtest</CardTitle>
            </CardHeader>
            <CardContent>
              <InlineBacktest strategyId={strategyId} />
            </CardContent>
          </Card>

          {backtestResults.data && backtestResults.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Previous Backtests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {backtestResults.data.map((bt) => (
                    <Link
                      key={bt.id}
                      href={`/backtest/${bt.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-sm">
                        <span className="font-medium">
                          {bt.start_date} → {bt.end_date}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ₹
                          {bt.initial_capital.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span>
                          CAGR:{" "}
                          {bt.metrics.cagr !== null
                            ? `${(bt.metrics.cagr * 100).toFixed(1)}%`
                            : "--"}
                        </span>
                        <span>
                          Sharpe:{" "}
                          {bt.metrics.sharpe_ratio?.toFixed(2) ?? "--"}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "playbook" && (
        <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden bg-white p-6">
          <PlaybookView playbook={playbookData || null} isLoading={playbookLoading} />
        </Card>
      )}

      {activeTab === "monitor" && (
        <DriftMonitorCard strategyId={strategyId} />
      )}

      {activeTab === "rebalance" && (
        <RebalanceExecutionCard strategyId={strategyId} />
      )}
    </div>


  );
}

