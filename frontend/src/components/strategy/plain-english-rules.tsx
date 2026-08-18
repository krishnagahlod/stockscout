"use client";

import { Loader2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ExplainRulesResponse } from "@/lib/api";

interface PlainEnglishRulesProps {
  explanation: ExplainRulesResponse | null;
  isLoading?: boolean;
}

const cleanText = (text: string) => text?.replace(/\*\*/g, "");

export function PlainEnglishRules({
  explanation,
  isLoading,
}: PlainEnglishRulesProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Translating rules to plain English...
      </div>
    );
  }

  if (!explanation) return null;

  return (
    <div className="space-y-5">
      {/* Strategy Summary */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background border border-indigo-100 dark:border-indigo-900/50 p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">{cleanText(explanation.strategy_summary)}</p>
      </div>

      {/* Filter Explanations */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
          <span className="w-4 h-px bg-slate-200"></span> Core Rules
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {explanation.filter_explanations.map((fe, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm"
            >
              <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <Info className="h-3 w-3 text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 leading-relaxed">{cleanText(fe.explanation)}</p>
                <div className="mt-1.5">
                  <Badge variant="secondary" className="text-[9px] font-mono bg-slate-50 text-slate-500 hover:bg-slate-100 px-1.5 py-0 border-0">
                    {fe.metric} {fe.op} {String(fe.value)}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking */}
      {explanation.ranking_explanation && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
          <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
            Ranking Engine
          </h4>
          <p className="text-xs text-amber-900/80 font-medium">
            {cleanText(explanation.ranking_explanation)}
          </p>
        </div>
      )}

      {/* Suitability */}
      {explanation.suitability && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
          <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
            Who is this for?
          </h4>
          <p className="text-xs font-medium text-emerald-800">
            {cleanText(explanation.suitability)}
          </p>
        </div>
      )}
    </div>
  );
}
