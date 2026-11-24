"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { rupees, pct, shortTicker } from "@/lib/format";
import type { Position } from "@/lib/portfolio";
import { deleteHolding } from "./actions";

export function HoldingsTable({ positions }: { positions: Position[] }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-100">
            <th className="py-2 font-medium">Company</th>
            <th className="py-2 font-medium text-right">Shares</th>
            <th className="py-2 font-medium text-right hidden sm:table-cell">Avg cost</th>
            <th className="py-2 font-medium text-right">Value</th>
            <th className="py-2 font-medium text-right">Gain / loss</th>
            <th className="py-2 font-medium text-right hidden md:table-cell">Share of total</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.stock.stock_id} className="border-b border-slate-50 align-middle">
              <td className="py-3">
                <Link href={`/stocks/${shortTicker(p.stock.ticker)}`} className="font-medium text-slate-900 hover:text-indigo-600">{p.stock.name}</Link>
                <p className="text-xs text-slate-400">{shortTicker(p.stock.ticker)} · {p.stock.sector}</p>
              </td>
              <td className="py-3 text-right tabular-nums">{p.quantity}</td>
              <td className="py-3 text-right tabular-nums hidden sm:table-cell">{rupees(p.invested / p.quantity, true)}</td>
              <td className="py-3 text-right tabular-nums font-semibold">{rupees(p.value)}</td>
              <td className={`py-3 text-right tabular-nums ${p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {rupees(p.pnl)}<span className="block text-xs">{pct(p.pnlPct, 1, true)}</span>
              </td>
              <td className="py-3 text-right tabular-nums hidden md:table-cell">{pct(p.weight, 0)}</td>
              <td className="py-3 text-right">
                {confirm === p.stock.stock_id ? (
                  <span className="inline-flex gap-2 text-xs">
                    <button className="text-rose-600 font-semibold" disabled={pending}
                      onClick={() => start(async () => { for (const id of p.lotIds) await deleteHolding(id); setConfirm(null); })}>Remove</button>
                    <button className="text-slate-500" onClick={() => setConfirm(null)}>Keep</button>
                  </span>
                ) : (
                  <button aria-label={`Remove ${p.stock.name}`} className="p-1 text-slate-300 hover:text-rose-500" onClick={() => setConfirm(p.stock.stock_id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
