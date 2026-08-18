"use client";

import { useEffect } from "react";
import { Eye, Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuickPreview } from "@/hooks/use-llm";
import type { StrategyRules, QuickPreviewResponse } from "@/lib/api";

interface StrategyPreviewCardProps {
  rules: StrategyRules;
}

export function StrategyPreviewCard({ rules }: StrategyPreviewCardProps) {
  const preview = useQuickPreview();

  useEffect(() => {
    preview.mutate(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 my-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="h-4 w-4 text-primary" />
        Strategy Preview
      </div>

      {/* Filters as plain text */}
      <div className="flex flex-wrap gap-1.5">
        {rules.filters.map((f, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {f.metric} {f.op} {String(f.value)}
          </Badge>
        ))}
        {rules.ranking && (
          <Badge variant="outline" className="text-xs">
            Rank by {rules.ranking.metric || "composite"}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs border-primary/20 bg-primary/5 text-primary">
          {rules.position_sizing === "inverse_volatility" ? "Risk-Adjusted Sizing" : "Equal Weighting"}
        </Badge>
        {rules.strategy_type && rules.strategy_type !== "long_only" && (
          <Badge variant="outline" className="text-xs border-purple-500/20 bg-purple-500/5 text-purple-600">
            {rules.strategy_type === "long_short" ? "Long/Short" : "Market Neutral"} 
            {rules.hedge_ratio ? ` (Hedge: ${rules.hedge_ratio * 100}%)` : ""}
          </Badge>
        )}
      </div>

      {/* Preview count */}
      {preview.isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking how many stocks match...
        </div>
      )}

      {preview.data && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-semibold text-primary">
              {preview.data.match_count}
            </span>{" "}
            stocks match out of {preview.data.total_universe}
          </p>

          {preview.data.top_stocks.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Top picks: </span>
              {preview.data.top_stocks.map((s, i) => (
                <span key={s.symbol}>
                  {s.name || s.symbol.replace('.NS', '')}
                  {i < preview.data!.top_stocks.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {rules.warnings && rules.warnings.length > 0 && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mt-2">
          <h4 className="text-[11px] font-bold text-orange-700 uppercase tracking-wider mb-1">
            Factor Warnings
          </h4>
          <ul className="list-disc pl-4 space-y-1">
            {rules.warnings.map((w, i) => (
              <li key={i} className="text-xs font-medium text-orange-900">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Click <strong>Build My Strategy</strong> above when you're happy with
        this, or keep chatting to refine it.
      </p>
    </div>
  );
}
