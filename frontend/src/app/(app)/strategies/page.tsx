"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Trash2,
  ArrowRight,
  Calculator,
  BarChart3,
  PieChart,
  BookOpen,
  Loader2,
  FolderPlus,
} from "lucide-react";
import { useStrategies, useDeleteStrategy } from "@/hooks/use-strategies";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  backtested: "default",
  active: "default",
  archived: "outline",
};

export default function StrategiesPage() {
  const { data, isLoading } = useStrategies();
  const deleteStrategy = useDeleteStrategy();
  const [isNavigating, setIsNavigating] = useState(false);

  const strategies = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Strategies</h2>
          <p className="text-muted-foreground">
            Create and manage your investment strategies
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/strategies/create" onClick={() => setIsNavigating(true)}>
            <Button disabled={isNavigating}>
              {isNavigating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isNavigating ? "Loading..." : "Build with AI"}
            </Button>
          </Link>
          <Link href="/strategies/create?type=custom">
            <Button variant="outline">
              <FolderPlus className="mr-2 h-4 w-4" />
              Custom Portfolio
            </Button>
          </Link>
          <Link href="/screener">
            <Button variant="outline">
              <Calculator className="mr-2 h-4 w-4" />
              Manual Screener
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-5 pb-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : strategies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">No strategies yet</p>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Describe your investment goal and let AI build a strategy, or use
              the manual screener to set exact filters.
            </p>
            <div className="flex gap-3">
              <Link href="/strategies/create" onClick={() => setIsNavigating(true)}>
                <Button disabled={isNavigating}>
                  {isNavigating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isNavigating ? "Loading..." : "Build with AI"}
                </Button>
              </Link>
              <Link href="/strategies/create?type=custom">
                <Button variant="outline">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Custom Portfolio
                </Button>
              </Link>
              <Link href="/screener">
                <Button variant="outline">
                  <Calculator className="mr-2 h-4 w-4" />
                  Manual Screener
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {strategies.map((s) => (
            <Card
              key={s.id}
              className="group hover:border-primary/50 transition-colors"
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <Link
                    href={`/strategies/${s.id}`}
                    className="text-sm font-semibold hover:underline flex-1 min-w-0 truncate"
                  >
                    {s.name}
                  </Link>
                  <Badge
                    variant={STATUS_COLORS[s.status] || "secondary"}
                    className="ml-2 shrink-0 text-[10px]"
                  >
                    {s.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
                  {s.description || "No description"}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <span>{s.universe}</span>
                  {s.created_at && (
                    <>
                      <span>·</span>
                      <span>
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1 pt-2 border-t">
                  <Link href={`/strategies/${s.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <ArrowRight className="h-3 w-3" />
                      View
                    </Button>
                  </Link>
                  <Link href="/backtest">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Backtest
                    </Button>
                  </Link>
                  <Link href="/portfolio">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <PieChart className="h-3 w-3" />
                      Portfolio
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => deleteStrategy.mutate(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
