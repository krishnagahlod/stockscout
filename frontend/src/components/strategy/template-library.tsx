import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, TrendingUp, ShieldCheck, Zap, LineChart, Banknote } from "lucide-react";
import type { StrategyRules } from "@/lib/api";

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  tags: string[];
  rules: StrategyRules;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "coffee-can",
    name: "Coffee Can Portfolio",
    description: "Buy-and-forget quality stocks with consistent growth and high capital efficiency.",
    icon: <Coffee className="h-6 w-6 text-amber-600" />,
    tags: ["Long Term", "Quality", "Low Churn"],
    rules: {
      name: "Coffee Can Portfolio",
      universe: "nifty500",
      filters: [
        { metric: "market_cap", op: ">", value: 5000 },
        { metric: "roe", op: ">", value: 0.15 },
        { metric: "debt_to_equity", op: "<", value: 0.5 },
      ],
      ranking: {
        weights: {
          roe: 0.5,
          revenue: 0.5
        },
      },
      selection: { top_n: 15 },
      rebalance: { frequency: "yearly" },
      position_sizing: "equal",
    }
  },
  {
    id: "dividend-aristocrats",
    name: "Dividend Aristocrats",
    description: "Companies with consistent dividend payouts, high yield, and stable business models.",
    icon: <Banknote className="h-6 w-6 text-emerald-600" />,
    tags: ["Income", "Value", "Defensive"],
    rules: {
      name: "Dividend Aristocrats",
      universe: "nifty500",
      filters: [
        { metric: "market_cap", op: ">", value: 10000 },
        { metric: "dividend_yield", op: ">", value: 0.025 },
        { metric: "roe", op: ">", value: 0.12 },
      ],
      ranking: {
        weights: {
          dividend_yield: 0.6,
          roe: 0.4
        },
      },
      selection: { top_n: 20 },
      rebalance: { frequency: "quarterly" },
      position_sizing: "inverse_volatility",
    }
  },
  {
    id: "garp",
    name: "GARP",
    description: "Growth At a Reasonable Price. High growth potential without paying exorbitant valuations.",
    icon: <LineChart className="h-6 w-6 text-blue-600" />,
    tags: ["Growth", "Value"],
    rules: {
      name: "GARP (Growth at Reasonable Price)",
      universe: "nifty500",
      filters: [
        { metric: "market_cap", op: ">", value: 2000 },
        { metric: "trailing_pe", op: "<", value: 25 },
        { metric: "trailing_pe", op: ">", value: 5 },
        { metric: "roe", op: ">", value: 0.15 },
      ],
      ranking: {
        weights: {
          roe: 0.5,
          trailing_pe: -0.5
        },
      },
      selection: { top_n: 20 },
      rebalance: { frequency: "quarterly" },
      position_sizing: "equal",
    }
  },
  {
    id: "quality-momentum",
    name: "Quality + Momentum",
    description: "Trending stocks that also possess strong fundamental quality and profitability.",
    icon: <Zap className="h-6 w-6 text-violet-600" />,
    tags: ["Momentum", "Quality", "Trend"],
    rules: {
      name: "Quality + Momentum",
      universe: "nifty500",
      filters: [
        { metric: "market_cap", op: ">", value: 2000 },
        { metric: "momentum_12m", op: ">", value: 0.10 },
        { metric: "roe", op: ">", value: 0.15 },
      ],
      ranking: {
        weights: {
          momentum_12m: 0.6,
          roe: 0.4
        },
      },
      selection: { top_n: 15 },
      rebalance: { frequency: "monthly" },
      position_sizing: "equal",
      trailing_stop_atr_multiple: 2.5,
    }
  },
  {
    id: "low-vol-shield",
    name: "Low Volatility Shield",
    description: "Defensive portfolio focusing on low beta, low volatility, and capital preservation.",
    icon: <ShieldCheck className="h-6 w-6 text-slate-600" />,
    tags: ["Defensive", "Low Risk", "Stable"],
    rules: {
      name: "Low Volatility Shield",
      universe: "nifty500",
      filters: [
        { metric: "market_cap", op: ">", value: 20000 },
        { metric: "beta", op: "<", value: 0.9 },
        { metric: "volatility_90d", op: "<", value: 0.3 },
      ],
      ranking: {
        weights: {
          volatility_90d: -0.5,
          beta: -0.5
        },
      },
      selection: { top_n: 20 },
      rebalance: { frequency: "quarterly" },
      position_sizing: "inverse_volatility",
      stop_loss_pct: 0.08,
    }
  },
  {
    id: "contrarian-value",
    name: "Contrarian Value",
    description: "Out-of-favor stocks trading at bargain prices but maintaining profitability.",
    icon: <TrendingUp className="h-6 w-6 text-rose-600" />,
    tags: ["Value", "Contrarian", "High Risk"],
    rules: {
      name: "Contrarian Value",
      universe: "nifty500",
      filters: [
        { metric: "trailing_pe", op: "<", value: 12 },
        { metric: "trailing_pe", op: ">", value: 2 },
        { metric: "price_to_book", op: "<", value: 1.5 },
        { metric: "roe", op: ">", value: 0.08 },
      ],
      ranking: {
        weights: {
          trailing_pe: -0.5,
          price_to_book: -0.5
        },
      },
      selection: { top_n: 20 },
      rebalance: { frequency: "quarterly" },
      position_sizing: "equal",
    }
  }
];

export function TemplateLibrary({ onSelect }: { onSelect: (template: StrategyTemplate) => void }) {
  return (
    <div className="w-full mt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4 px-2">
        <div className="h-px bg-slate-200 flex-1"></div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Or start from a template</span>
        <div className="h-px bg-slate-200 flex-1"></div>
      </div>
      
      <div className="flex overflow-x-auto gap-3 pb-4 px-2 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {STRATEGY_TEMPLATES.map((template) => (
          <div 
            key={template.id} 
            onClick={() => onSelect(template)}
            className="flex-shrink-0 w-64 p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer snap-start group flex flex-col"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors shrink-0">
                {template.icon}
              </div>
              <h4 className="text-sm font-bold text-slate-800 leading-tight">{template.name}</h4>
            </div>
            <p className="text-xs text-slate-500 flex-1 line-clamp-2 mt-1">
              {template.description}
            </p>
            <div className="mt-3 flex gap-1 flex-wrap">
              {template.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[9px] font-medium uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
