"use client";

import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight, GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PeerProps {
  peers?: Array<{
    symbol: string;
    name: string;
    market_cap: number;
    pe: number;
    pb: number;
    roe: number;
    dividend_yield: number;
  }>;
  currentSymbol: string;
}

export function PeerComparison({ peers, currentSymbol }: PeerProps) {
  if (!peers || peers.length === 0) return null;

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Sector Peer Valuation Matrix
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare valuation multiples and return ratios against industry peers
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200/80 dark:border-slate-800">
              <TableHead className="font-bold text-xs text-slate-700 dark:text-slate-300">Company</TableHead>
              <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">Market Cap (₹ Cr)</TableHead>
              <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">P/E</TableHead>
              <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">P/B</TableHead>
              <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">ROE %</TableHead>
              <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">Div. Yield %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peers.map((p) => {
              const isCurrent = p.symbol === currentSymbol.replace(".NS", "");
              return (
                <TableRow
                  key={p.symbol}
                  className={`hover:bg-slate-50/50 ${
                    isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20 font-semibold" : ""
                  }`}
                >
                  <TableCell className="text-xs">
                    <Link
                      href={`/stocks/${p.symbol}.NS`}
                      className="font-medium text-slate-900 dark:text-white hover:text-indigo-600 inline-flex items-center gap-1 group"
                    >
                      <span>{p.name}</span>
                      <span className="text-slate-400 group-hover:text-indigo-600 text-[10px]">
                        ({p.symbol})
                      </span>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-700 dark:text-slate-300">
                    ₹{formatNumber(p.market_cap)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {p.pe ? p.pe.toFixed(1) : "N/A"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-700 dark:text-slate-300">
                    {p.pb ? p.pb.toFixed(1) : "N/A"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {p.roe ? `${p.roe.toFixed(1)}%` : "N/A"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-600 dark:text-slate-400">
                    {p.dividend_yield ? `${(p.dividend_yield * (p.dividend_yield < 0.2 ? 100 : 1)).toFixed(1)}%` : "0.0%"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
