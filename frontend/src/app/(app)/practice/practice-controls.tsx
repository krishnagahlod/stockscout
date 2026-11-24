"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockAutocomplete } from "@/components/stock-autocomplete";
import { createClient } from "@/utils/supabase/client";
import { rupees } from "@/lib/format";
import { practiceTrade, resetPractice, type TradeResult } from "./actions";

function Result({ state }: { state: TradeResult }) {
  if (state.ok) return <p role="status" className="text-sm text-emerald-700">{state.ok}</p>;
  if (state.error) return <p role="alert" className="text-sm text-rose-600">{state.error}</p>;
  return null;
}

export function BuyForm() {
  const [state, action, pending] = useActionState(practiceTrade, {} as TradeResult);
  const [ticker, setTicker] = useState("");
  const [quote, setQuote] = useState<{ name: string; price: number } | null>(null);
  const [qty, setQty] = useState("1");
  const shares = Math.max(0, Math.floor(Number(qty) || 0));

  async function pick(symbol: string) {
    setTicker(symbol);
    const { data } = await createClient().from("stock_snapshot").select("name, price").eq("ticker", symbol).maybeSingle();
    setQuote(data?.price ? { name: data.name, price: Number(data.price) } : null);
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="side" value="buy" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm text-slate-600">Company or fund</label>
          <StockAutocomplete onSelect={pick} placeholder="e.g. NIFTYBEES or Coal India" />
        </div>
        <div>
          <label htmlFor="buy-qty" className="mb-1 block text-sm text-slate-600">Shares</label>
          <input id="buy-qty" name="quantity" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)}
            className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <Button type="submit" className="h-10 rounded-xl" disabled={!ticker || !shares || pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Buy with practice money
        </Button>
      </div>
      {quote && <p className="text-sm text-slate-600">{quote.name}: {rupees(quote.price, true)} a share. {shares} cost{shares === 1 ? "s" : ""} {rupees(quote.price * shares)}.</p>}
      <Result state={state} />
    </form>
  );
}

export function SellForm({ ticker, max }: { ticker: string; max: number }) {
  const [state, action, pending] = useActionState(practiceTrade, {} as TradeResult);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
        <input type="hidden" name="ticker" value={ticker} />
        <input type="hidden" name="side" value="sell" />
        <input name="quantity" type="number" min={1} max={max} step={1} defaultValue={max} aria-label={`Shares of ${ticker} to sell`}
          className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
        <Button type="submit" variant="outline" size="sm" className="h-8 rounded-lg" disabled={pending}>Sell</Button>
      </span>
      {state.error && <span role="alert" className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

export function ResetButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return <Button variant="ghost" className="rounded-xl text-slate-500" onClick={() => setConfirming(true)}><RotateCcw className="mr-2 h-4 w-4" />Start over</Button>;
  }
  return (
    <span className="flex items-center gap-2 text-sm text-slate-600">
      Clear all practice trades?
      <Button variant="destructive" size="sm" disabled={pending} onClick={() => start(async () => { await resetPractice(); setConfirming(false); })}>Yes, start over</Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
    </span>
  );
}
