import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { dataAsOf, getByTicker, getSnapshots } from "@/lib/market";
import { summarize } from "@/lib/portfolio";
import { PRACTICE_CASH, replay, type Trade } from "@/lib/practice";
import { niceDate, rupees, shortTicker } from "@/lib/format";
import { Change, PageTitle, Panel } from "@/components/kit";
import { BuyForm, ResetButton, SellForm } from "./practice-controls";

export const metadata = { title: "Practice | StockScout" };

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase.from("practice_trades").select("id, stock_id, quantity, price, traded_at").eq("user_id", user.id).order("traded_at", { ascending: false });
  if (error) throw new Error(`Could not load practice trades: ${error.message}`);
  const trades = (data ?? []) as Trade[];
  const book = replay(trades);
  const snaps = await getSnapshots(supabase, Array.from(new Set(trades.map((t) => t.stock_id))));
  const s = summarize(book.holdings, snaps);
  const worth = book.cash + s.value;
  const asOf = dataAsOf(Array.from(snaps.values()));

  // the Nifty 50 over the same time, as a yardstick
  let niftySince: number | null = null;
  const first = trades[trades.length - 1];
  const nifty = first ? await getByTicker(supabase, "^NSEI") : null;
  if (first && nifty?.price) {
    const { data: then } = await supabase.from("daily_prices").select("close").eq("stock_id", nifty.stock_id)
      .lte("date", first.traded_at.slice(0, 10)).order("date", { ascending: false }).limit(1).maybeSingle();
    if (then?.close) niftySince = nifty.price / Number(then.close) - 1;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageTitle title="Practice" subtitle="₹1,00,000 of pretend money at real closing prices. Nothing here is real, so mistakes are free." action={trades.length ? <ResetButton /> : undefined} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-sm text-slate-500">Practice money is worth</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{rupees(worth)}</p>
          <Change value={worth / PRACTICE_CASH - 1} suffix="since you started" className="text-sm" />
        </Panel>
        <Panel>
          <p className="text-sm text-slate-500">Cash left</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{rupees(book.cash)}</p>
          <p className="text-sm text-slate-500">{rupees(s.value)} in {s.positions.length} holding{s.positions.length === 1 ? "" : "s"}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-slate-500">Nifty 50 over the same time</p>
          {niftySince != null ? (
            <><p className="mt-1 font-display text-2xl font-bold"><Change value={niftySince} /></p><p className="text-sm text-slate-500">since your first practice trade</p></>
          ) : <p className="mt-1 text-sm text-slate-600">Make a first trade to compare with the market.</p>}
        </Panel>
      </div>

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900">Buy with practice money</h2>
        <p className="text-sm text-slate-500">Search any company or ETF. Trades use the latest closing price{asOf ? ` (${niceDate(asOf)})` : ""}. Real trades also cost brokerage and taxes.</p>
        <BuyForm />
      </Panel>

      {s.positions.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">Your practice holdings</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-slate-500"><th className="py-2 font-medium">Holding</th><th className="py-2 text-right font-medium">Shares</th><th className="py-2 text-right font-medium">Paid (avg)</th><th className="py-2 text-right font-medium">Now</th><th className="py-2 text-right font-medium">Gain or loss</th><th className="py-2 text-right font-medium sr-only sm:not-sr-only">Sell</th></tr></thead>
              <tbody>
                {s.positions.map((p) => (
                  <tr key={p.stock.stock_id} className="border-b border-slate-50 align-middle">
                    <td className="py-2"><Link href={`/stocks/${shortTicker(p.stock.ticker)}`} className="font-medium text-slate-900 hover:text-indigo-600">{p.stock.name}</Link></td>
                    <td className="py-2 text-right tabular-nums">{p.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{rupees(p.invested / p.quantity, true)}</td>
                    <td className="py-2 text-right tabular-nums">{rupees(p.stock.price, true)}</td>
                    <td className="py-2 text-right"><span className="tabular-nums">{rupees(p.pnl)}</span> <Change value={p.pnlPct} className="text-xs" /></td>
                    <td className="py-2 text-right"><SellForm ticker={shortTicker(p.stock.ticker)} max={p.quantity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.checks.length > 0 && (
            <ul className="mt-5 space-y-2">
              {s.checks.map((c) => (
                <li key={c.title} className="flex gap-2 text-sm">
                  {c.tone === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />}
                  <span><strong className="font-semibold text-slate-900">{c.title}.</strong> <span className="text-slate-600">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <Panel>
          <p className="text-slate-700">No practice holdings yet. Not sure where to start? <Link href="/start" className="font-semibold text-indigo-600 underline">Start here</Link> shows a Nifty 50 ETF path, and any <Link href="/ideas" className="font-semibold text-indigo-600 underline">idea</Link> can be tried with practice money.</p>
        </Panel>
      )}

      {trades.length > 0 && (
        <details className="glass-card rounded-3xl p-5 md:p-6 group">
          <summary className="cursor-pointer list-none font-display font-bold text-slate-900">Trade history <span className="text-sm font-normal text-slate-500 group-open:hidden">({trades.length} trade{trades.length === 1 ? "" : "s"}, tap to see)</span></summary>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {trades.map((t) => {
              const snap = snaps.get(t.stock_id);
              return (
                <li key={t.id} className="flex justify-between gap-3 py-2">
                  <span>{t.quantity > 0 ? "Bought" : "Sold"} {Math.abs(t.quantity)} {snap ? shortTicker(snap.ticker) : "shares"} at {rupees(Number(t.price), true)}</span>
                  <span className="text-slate-500">{niceDate(t.traded_at.slice(0, 10))}</span>
                </li>
              );
            })}
          </ul>
          {book.realized !== 0 && <p className="mt-3 text-sm text-slate-600">Gains and losses already taken by selling: {rupees(book.realized)}.</p>}
        </details>
      )}
    </div>
  );
}
