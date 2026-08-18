"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StockExplainCard } from "@/components/strategy/stock-explain-card";
import type { ScoredUniverse } from "@/lib/api";

interface ResultsTableProps {
  data: ScoredUniverse;
}

export function ResultsTable({ data }: ResultsTableProps) {
  // Collect all metric columns from the first stock's metric_values
  const metricColumns = data.stocks.length > 0
    ? Object.keys(data.stocks[0].metric_values)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Universe: {data.total_universe} stocks</span>
        <span>Passed filters: {data.filtered_count}</span>
        <span>Showing: {data.stocks.length}</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead className="text-right">Score</TableHead>
              {metricColumns.map((col) => (
                <TableHead key={col} className="text-right">
                  {col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </TableHead>
              ))}
              <TableHead className="text-right">Analysis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.stocks.map((stock, i) => (
              <TableRow key={stock.symbol}>
                <TableCell className="font-mono text-muted-foreground">
                  {i + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {stock.symbol.replace(".NS", "")}
                </TableCell>
                <TableCell>{stock.name}</TableCell>
                <TableCell>
                  {stock.sector && (
                    <Badge variant="secondary" className="text-xs">
                      {stock.sector}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {stock.composite_score?.toFixed(1) ?? "—"}
                </TableCell>
                {metricColumns.map((col) => (
                  <TableCell key={col} className="text-right font-mono">
                    {formatMetricValue(col, stock.metric_values[col])}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <StockExplainCard symbol={stock.symbol} />
                </TableCell>
              </TableRow>
            ))}
            {data.stocks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5 + metricColumns.length} className="text-center py-8 text-muted-foreground">
                  No stocks match the current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatMetricValue(metric: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  // Percentage-like metrics (stored as decimals: 0.04 = 4%)
  const PCT_METRICS = [
    "yield", "margin", "roe", "roa", "roce",
    "cagr", "volatility", "momentum", "drawdown",
  ];
  if (PCT_METRICS.some((k) => metric.includes(k))) {
    return `${(value * 100).toFixed(2)}%`;
  }

  // Large numbers (currency in crores)
  if (metric === "market_cap" || metric === "revenue" || metric === "ebitda" || metric === "free_cash_flow" || metric === "net_income" || metric === "total_debt") {
    if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(1)}L Cr`;
    if (Math.abs(value) >= 100) return `${value.toFixed(0)} Cr`;
    return `${value.toFixed(1)} Cr`;
  }

  // Ratio metrics
  if (metric === "trailing_pe" || metric === "price_to_book" || metric === "ev_to_ebitda" || metric === "debt_to_equity") {
    return value.toFixed(2);
  }

  // Default
  return value.toFixed(2);
}
