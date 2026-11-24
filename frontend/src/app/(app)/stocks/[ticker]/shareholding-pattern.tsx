"use client";

import { PieChart, Users, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ShareholdingProps {
  shareholding?: Array<{
    quarter: string;
    promoter: number;
    fii: number;
    dii: number;
    public: number;
    pledged_pct: number;
  }>;
}

export function ShareholdingPattern({ shareholding }: ShareholdingProps) {
  if (!shareholding || shareholding.length === 0) return null;

  const latest = shareholding[shareholding.length - 1];
  const hasPledge = latest.pledged_pct > 0;

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Shareholding Pattern (%)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quarterly institutional flow and promoter ownership trends
          </p>
        </div>

        {hasPledge && (
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Pledged: {latest.pledged_pct}% of Promoter Holding
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200/80 dark:border-slate-800">
              <TableHead className="font-bold text-xs text-slate-700 dark:text-slate-300">Category</TableHead>
              {shareholding.map((s) => (
                <TableHead key={s.quarter} className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">
                  {s.quarter}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-slate-50/50">
              <TableCell className="font-medium text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Promoter
              </TableCell>
              {shareholding.map((s) => (
                <TableCell key={s.quarter} className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {s.promoter}%
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="hover:bg-slate-50/50">
              <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                FII (Foreign Institutional)
              </TableCell>
              {shareholding.map((s) => (
                <TableCell key={s.quarter} className="text-right text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {s.fii}%
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="hover:bg-slate-50/50">
              <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                DII (Mutual Funds & Insurance)
              </TableCell>
              {shareholding.map((s) => (
                <TableCell key={s.quarter} className="text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {s.dii}%
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="hover:bg-slate-50/50">
              <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                Public & Retail
              </TableCell>
              {shareholding.map((s) => (
                <TableCell key={s.quarter} className="text-right text-xs text-slate-600 dark:text-slate-400">
                  {s.public}%
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
