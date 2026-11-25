import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

import { getUniverse, dataAsOf } from "@/lib/market";
import { dayChange } from "@/lib/metrics";
import { summarize, type HoldingRow } from "@/lib/portfolio";
import { STARTER_IDEAS } from "@/lib/starter-ideas";
import { niceDate, pct, rupees, shortTicker } from "@/lib/format";
import { Change, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [universe, { data: profile }, { data: holdings }, { data: ideas }] = await Promise.all([
    getUniverse(),
    supabase.from("user_profiles").select("display_name").eq("user_id", user!.id).maybeSingle(),
    supabase.from("holdings").select("id, stock_id, quantity, avg_buy_price").eq("user_id", user!.id),
    supabase.from("strategies").select("id, name, description, rules_json").order("created_at", { ascending: false }).limit(10),
  ]);

  const snaps = new Map(universe.map((s) => [s.stock_id, s]));
  const p = summarize((holdings ?? []) as HoldingRow[], snaps);
  const movers = [...p.positions].filter((x) => dayChange(x.stock) != null).sort((a, b) => Math.abs(dayChange(b.stock)!) - Math.abs(dayChange(a.stock)!)).slice(0, 4);
  const bigCos = universe.filter((s) => (s.market_cap_cr ?? 0) > 20000 && dayChange(s) != null).sort((a, b) => dayChange(b)! - dayChange(a)!);
  const market = { up: bigCos.slice(0, 3), down: bigCos.slice(-3).reverse() };
  const savedIdeas = (ideas ?? []).filter((i) => i.rules_json?.version === 2).slice(0, 3);
  const name = profile?.display_name?.split(" ")[0];
  const firstWarning = p.checks.find((c) => c.tone === "warn");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{name ? `Hi ${name}` : "Welcome"} 👋</h1>
        <p className="text-slate-500">Prices as of {niceDate(dataAsOf(universe))}.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          {p.positions.length ? (
            <>
              <p className="text-sm text-slate-500">Your portfolio</p>
              <p className="mt-1 font-display text-4xl font-bold tabular-nums">{rupees(p.value)}</p>
              <p className="mt-1 text-sm text-slate-600">
                <Change value={p.dayPct} suffix="on the last day" /> ·{" "}
                <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{p.pnl >= 0 ? "+" : "−"}{rupees(Math.abs(p.pnl))} ({pct(p.pnlPct, 1, true)})</span> overall
              </p>
              {movers.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {movers.map((m) => (
                    <Link key={m.stock.stock_id} href={`/stocks/${shortTicker(m.stock.ticker)}`} className="rounded-2xl bg-white/70 border border-slate-100 p-3 hover:border-indigo-200">
                      <p className="text-sm font-medium truncate">{m.stock.name}</p>
                      <Change value={dayChange(m.stock)} className="text-sm" />
                    </Link>
                  ))}
                </div>
              )}
              {firstWarning && <p className="mt-4 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">💡 {firstWarning.title}. <Link href="/portfolio" className="underline">See why</Link></p>}
              <Link href="/portfolio" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">Open portfolio <ArrowRight className="h-4 w-4" /></Link>
            </>
          ) : (
            <>
              <p className="font-display text-xl font-bold text-slate-900">New to investing?</p>
              <p className="mt-3 text-slate-700 leading-relaxed">Answer three quick questions about your money and get a plain path for where to begin, with real numbers on how much things have risen and fallen.</p>
              <Link href="/start"><Button className="mt-5 rounded-xl">Start here <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
            </>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <p className="font-display text-lg font-bold text-slate-900 flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" />Have an idea?</p>
          <form action="/ideas" method="get" className="mt-3 space-y-3">
            <textarea name="q" rows={3} required placeholder="e.g. Safe companies that pay dividends, I'll invest ₹3,000 a month"
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <Button type="submit" className="w-full rounded-xl">Continue</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {STARTER_IDEAS.slice(0, 3).map((s) => (
              <Link key={s.slug} href={`/ideas/s-${s.slug}`} className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700">{s.emoji} {s.name}</Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">What moved among big companies</h2>
          <p className="text-sm text-slate-500 mb-3">Biggest rises and falls on the last trading day (companies over ₹20,000 Cr).</p>
          <div className="grid grid-cols-2 gap-4">
            {[market.up, market.down].map((list, i) => (
              <ul key={i} className="space-y-2">
                {list.map((s) => (
                  <li key={s.stock_id}>
                    <Link href={`/stocks/${shortTicker(s.ticker)}`} className="flex items-center justify-between gap-2 text-sm hover:text-indigo-600">
                      <span className="truncate">{s.name}</span><Change value={dayChange(s)} className="text-xs shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Your ideas</h2>
          {savedIdeas.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing saved yet. <Link href="/ideas" className="text-indigo-600 underline">Try an idea</Link>.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {savedIdeas.map((i) => (
                <li key={i.id}><Link href={`/ideas/${i.id}`} className="block py-2.5 hover:text-indigo-600"><span className="font-medium">{i.name}</span><span className="block text-xs text-slate-500 truncate">{i.description}</span></Link></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>


    </div>
  );
}
