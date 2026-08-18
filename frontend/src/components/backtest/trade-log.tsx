"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradeRecord } from "@/lib/api";

interface TradeLogProps {
  trades: TradeRecord[];
}

const PAGE_SIZE = 20;

export function TradeLog({ trades }: TradeLogProps) {
  const [page, setPage] = useState(0);

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trade Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No trades executed</p>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(trades.length / PAGE_SIZE);
  const paged = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Trade Log ({trades.length} trades)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((t, i) => (
                <TableRow key={`${t.date}-${t.symbol}-${t.action}-${i}`}>
                  <TableCell className="text-sm font-mono">
                    {t.date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.action === "BUY" ? "default" : "secondary"}
                    >
                      {t.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {t.symbol.replace(".NS", "")}
                  </TableCell>
                  <TableCell className="text-sm max-w-32 truncate">
                    {t.name}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {t.shares}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{t.price.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{t.value.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
