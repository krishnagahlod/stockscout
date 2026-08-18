"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HoldingSnapshot } from "@/lib/api";

interface HoldingsTableProps {
  holdings: HoldingSnapshot[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">End-of-Period Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No holdings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          End-of-Period Holdings ({holdings.length} stocks)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings
                .sort((a, b) => b.weight - a.weight)
                .map((h) => (
                  <TableRow key={h.symbol}>
                    <TableCell className="font-medium">
                      {h.symbol.replace(".NS", "")}
                    </TableCell>
                    <TableCell className="text-sm max-w-40 truncate">
                      {h.name}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {h.shares}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(h.weight * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{h.avg_cost.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{h.current_price.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        h.pnl_pct >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {(h.pnl_pct * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
