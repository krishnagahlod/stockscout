"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, TrendingUp, Landmark, Banknote } from "lucide-react";

interface StatementsProps {
  statements?: {
    pnl?: Array<{
      year: string;
      sales: number;
      operating_profit: number;
      opm_pct: number;
      net_profit: number;
      eps: number;
    }>;
    balance_sheet?: Array<{
      year: string;
      share_capital: number;
      reserves: number;
      borrowings: number;
      total_liabilities: number;
      fixed_assets: number;
      cwip: number;
      other_assets: number;
    }>;
    cash_flow?: Array<{
      year: string;
      cash_from_ops: number;
      cash_from_investing: number;
      cash_from_financing: number;
      net_cash_flow: number;
    }>;
  };
}

export function FinancialStatements({ statements }: StatementsProps) {
  const [activeTab, setActiveTab] = useState<"pnl" | "bs" | "cf">("pnl");

  if (!statements || (!statements.pnl && !statements.balance_sheet)) {
    return null;
  }

  const pnl = statements.pnl || [];
  const bs = statements.balance_sheet || [];
  const cf = statements.cash_flow || [];

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Financial Statements (Consolidated Figures in ₹ Cr)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            5-Year historical performance benchmarked across key line items
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("pnl")}
            className={`text-xs rounded-lg px-3 py-1 font-semibold flex items-center transition-colors ${
              activeTab === "pnl"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            Profit & Loss
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bs")}
            className={`text-xs rounded-lg px-3 py-1 font-semibold flex items-center transition-colors ${
              activeTab === "bs"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Landmark className="w-3.5 h-3.5 mr-1" />
            Balance Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cf")}
            className={`text-xs rounded-lg px-3 py-1 font-semibold flex items-center transition-colors ${
              activeTab === "cf"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Banknote className="w-3.5 h-3.5 mr-1" />
            Cash Flow
          </button>
        </div>
      </div>

      {/* Profit & Loss Table */}
      {activeTab === "pnl" && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200/80 dark:border-slate-800">
                <TableHead className="font-bold text-xs text-slate-700 dark:text-slate-300 w-48">Metric</TableHead>
                {pnl.map((row) => (
                  <TableHead key={row.year} className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">
                    {row.year}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-900 dark:text-white">Revenue / Sales</TableCell>
                {pnl.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                    ₹{formatNumber(r.sales)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">Operating Profit</TableCell>
                {pnl.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs text-slate-700 dark:text-slate-300">
                    ₹{formatNumber(r.operating_profit)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">OPM %</TableCell>
                {pnl.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    {r.opm_pct}%
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50 font-bold bg-slate-50/40 dark:bg-slate-800/30">
                <TableCell className="font-bold text-xs text-emerald-700 dark:text-emerald-400">Net Profit (PAT)</TableCell>
                {pnl.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{formatNumber(r.net_profit)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">EPS (₹)</TableCell>
                {pnl.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-medium text-slate-700 dark:text-slate-300">
                    ₹{r.eps}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Balance Sheet Table */}
      {activeTab === "bs" && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200/80 dark:border-slate-800">
                <TableHead className="font-bold text-xs text-slate-700 dark:text-slate-300 w-48">Line Item</TableHead>
                {bs.map((row) => (
                  <TableHead key={row.year} className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">
                    {row.year}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-900 dark:text-white">Share Capital</TableCell>
                {bs.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs text-slate-700 dark:text-slate-300">
                    ₹{formatNumber(r.share_capital)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">Reserves & Surplus</TableCell>
                {bs.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                    ₹{formatNumber(r.reserves)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-rose-600 dark:text-rose-400">Total Borrowings</TableCell>
                {bs.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-medium text-rose-600 dark:text-rose-400">
                    ₹{formatNumber(r.borrowings)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">Fixed Assets</TableCell>
                {bs.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs text-slate-700 dark:text-slate-300">
                    ₹{formatNumber(r.fixed_assets)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50 font-bold bg-slate-50/40 dark:bg-slate-800/30">
                <TableCell className="font-bold text-xs text-slate-900 dark:text-white">Total Liabilities / Assets</TableCell>
                {bs.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-bold text-slate-900 dark:text-white">
                    ₹{formatNumber(r.total_liabilities)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Cash Flow Table */}
      {activeTab === "cf" && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200/80 dark:border-slate-800">
                <TableHead className="font-bold text-xs text-slate-700 dark:text-slate-300 w-48">Activity</TableHead>
                {cf.map((row) => (
                  <TableHead key={row.year} className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">
                    {row.year}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-emerald-700 dark:text-emerald-400">Operating Cash Flow (CFO)</TableCell>
                {cf.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{formatNumber(r.cash_from_ops)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">Investing Cash Flow (CFI)</TableCell>
                {cf.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs text-slate-700 dark:text-slate-300">
                    ₹{formatNumber(r.cash_from_investing)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">Financing Cash Flow (CFF)</TableCell>
                {cf.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs text-slate-700 dark:text-slate-300">
                    ₹{formatNumber(r.cash_from_financing)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50/50 font-bold bg-slate-50/40 dark:bg-slate-800/30">
                <TableCell className="font-bold text-xs text-slate-900 dark:text-white">Net Cash Flow</TableCell>
                {cf.map((r) => (
                  <TableCell key={r.year} className="text-right text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    ₹{formatNumber(r.net_cash_flow)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
