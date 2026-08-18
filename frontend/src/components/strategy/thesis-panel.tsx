"use client";

import { Loader2, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestmentThesis } from "@/lib/api";

interface ThesisPanelProps {
  thesis: InvestmentThesis | null;
  isLoading?: boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const cleanText = (text: string) => text?.replace(/\*\*/g, "");

export function ThesisPanel({ thesis, isLoading }: ThesisPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating investment thesis...
      </div>
    );
  }

  if (!thesis) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-2xl bg-indigo-600 p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        <div className="flex items-start gap-3 relative z-10">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Lightbulb className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm text-white/90 font-medium leading-relaxed mt-1">{cleanText(thesis.summary)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Points */}
        {thesis.key_points.length > 0 && (
          <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-2 h-2 text-emerald-600" /></span>
              Investment Edge
            </h4>
            <ul className="space-y-2">
              {thesis.key_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1 shrink-0 text-[10px] font-black">•</span>
                  <span className="text-xs text-slate-700 font-medium leading-relaxed">{cleanText(point)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {thesis.risks.length > 0 && (
          <div className="space-y-3 p-4 rounded-xl border border-rose-50 bg-rose-50/30">
            <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-rose-100 flex items-center justify-center"><AlertTriangle className="w-2 h-2 text-rose-600" /></span>
              Key Risks
            </h4>
            <div className="space-y-2.5">
              {thesis.risks.map((risk, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{risk.factor}</span>
                    <Badge className={`text-[9px] px-1.5 py-0 ${SEVERITY_STYLES[risk.severity] || SEVERITY_STYLES.medium}`}>
                      {risk.severity}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{cleanText(risk.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendation */}
      {thesis.recommendation && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bottom Line</h4>
            <p className="text-sm font-semibold text-slate-800">{cleanText(thesis.recommendation)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
