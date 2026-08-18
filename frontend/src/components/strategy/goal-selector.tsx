"use client";

import {
  Banknote,
  TrendingUp,
  Shield,
  Search,
  Zap,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const GOALS = [
  {
    id: "steady_income",
    icon: Banknote,
    title: "Steady Income",
    description: "Earn regular dividends — like rent, but from stocks",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
  },
  {
    id: "long_term_growth",
    icon: TrendingUp,
    title: "Long-Term Growth",
    description: "Grow your wealth over 5-10 years with quality companies",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "low_risk",
    icon: Shield,
    title: "Safe & Stable",
    description: "Preserve your money with low-risk, reliable stocks",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    id: "undervalued",
    icon: Search,
    title: "Find Bargains",
    description: "Discover quality companies selling below their true value",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "momentum",
    icon: Zap,
    title: "Riding Momentum",
    description: "Invest in stocks that are trending upward right now",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  {
    id: "unsure",
    icon: HelpCircle,
    title: "Help Me Decide",
    description: "Not sure? I'll ask a few questions and suggest what's right for you",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-950/30",
  },
] as const;

export type GoalId = (typeof GOALS)[number]["id"];

interface GoalSelectorProps {
  onSelect: (goalId: GoalId) => void;
  disabled?: boolean;
}

export function GoalSelector({ onSelect, disabled }: GoalSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 px-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          What are you looking for?
        </h2>
        <p className="text-muted-foreground max-w-md">
          Pick a goal that matches what you want from your investments. No
          experience needed — I'll guide you through the rest.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full">
        {GOALS.map((goal) => {
          const Icon = goal.icon;
          return (
            <Card
              key={goal.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md border-2 border-transparent hover:border-primary/30 ${
                disabled ? "opacity-50 pointer-events-none" : ""
              }`}
              onClick={() => !disabled && onSelect(goal.id)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div
                  className={`shrink-0 w-10 h-10 rounded-lg ${goal.bg} flex items-center justify-center`}
                >
                  <Icon className={`h-5 w-5 ${goal.color}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{goal.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {goal.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Or type anything in the chat below to describe what you want
      </p>
    </div>
  );
}
