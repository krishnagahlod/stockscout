"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExplainStock } from "@/hooks/use-llm";
import type { StockExplanationData } from "@/lib/api";

interface StockExplainCardProps {
  symbol: string;
  strategyId?: number;
}

export function StockExplainCard({
  symbol,
  strategyId,
}: StockExplainCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<StockExplanationData | null>(
    null
  );
  const explainMutation = useExplainStock();

  const handleToggle = () => {
    if (!isOpen && !explanation) {
      explainMutation.mutate(
        { symbol, strategyId },
        {
          onSuccess: (data) => setExplanation(data),
        }
      );
    }
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="h-7 text-xs gap-1"
      >
        {explainMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {isOpen ? "Hide" : "Explain"}
      </Button>

      {isOpen && explanation && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-3 text-sm">
          {/* Reasons */}
          {explanation.reasons.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">
                Why selected
              </h5>
              <ul className="space-y-1">
                {explanation.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Star className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                    <span className="text-xs">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strengths */}
          {explanation.strengths.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">
                Strengths
              </h5>
              <ul className="space-y-1">
                {explanation.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                    <span className="text-xs">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {explanation.concerns.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">
                Watch out for
              </h5>
              <ul className="space-y-1">
                {explanation.concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                    <span className="text-xs">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Overall */}
          {explanation.overall && (
            <p className="text-xs text-muted-foreground italic border-t pt-2">
              {explanation.overall}
            </p>
          )}
        </div>
      )}

      {isOpen && explainMutation.isPending && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing {symbol}...
        </div>
      )}

      {isOpen && explainMutation.isError && (
        <p className="mt-2 text-xs text-destructive">
          Failed to explain. Try again.
        </p>
      )}
    </div>
  );
}
