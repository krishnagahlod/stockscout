import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

import { getUniverse, getByTicker, dataAsOf } from "@/lib/market";
import { dayChange } from "@/lib/metrics";
import { summarize, type HoldingRow } from "@/lib/portfolio";
import { upcoming, type StockEvent } from "@/lib/events";
import { STARTER_IDEAS } from "@/lib/starter-ideas";
import { niceDate, pct, rupees } from "@/lib/format";
import { Change, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";

const door = "flex flex-col rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = new Date().toISOString().slice(0, 10);
  const [universe, nifty, { data: profile }, { data: holdings }, { data: ideas }] = await Promise.all([
    getUniverse(),
    getByTicker(supabase, "^NSEI"),
    supabase.from("user_profiles").select("display_name").eq("user_id", user!.id).maybeSingle(),
    supabase.from("holdings").select("id, stock_id, quantity, avg_buy_price").eq("user_id", user!.id),
    supabase.from("strategies").select("id, name, description, rules_json").order("created_at", { ascending: false }).limit(10),
  ]);

  const snaps = new Map(universe.map((s) => [s.stock_id, s]));
  const p = summarize((holdings ?? []) as HoldingRow[], snaps);
  const owned = Array.from(new Set(p.positions.map((x) => x.stock.stock_id)));
  const { data: eventRows } = owned.length
    ? await supabase.from("stock_events").select("stock_id, kind, event_date, amount, source").in("stock_id", owned).gte("event_date", today)
    : { data: [] };
  const soon = upcoming((eventRows ?? []) as StockEvent[], today, 30).filter((e) => e.kind !== "split").slice(0, 5);
  const savedIdeas = (ideas ?? []).filter((i) => i.rules_json?.version === 2).slice(0, 3);
  const name = profile?.display_name?.split(" ")[0];
  const firstWarning = p.checks.find((c) => c.tone === "warn");
  const niftyDay = nifty ? dayChange(nifty) : null;
  const asOf = dataAsOf(universe);
  const hasForYou = p.positions.length > 0 || savedIdeas.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{name ? `Hi ${name}` : "Welcome"}</h1>
        <p className="mt-2 font-display text-lg md:text-xl leading-snug text-slate-700">
          {niftyDay != null && <>The Nifty 50 {niftyDay >= 0 ? "rose" : "fell"} {pct(Math.abs(niftyDay))} on {niceDate(asOf)}. </>}
          {p.positions.length > 0 && <>Your holdings are worth <span className="font-bold tabular-nums text-slate-900">{rupees(p.value)}</span>.</>}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={door}>
          <Compass className="h-6 w-6 text-indigo-600" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">New to this?</h2>
          <p className="mt-1 flex-1 text-sm text-slate-600">Three quick questions, then a plain path for where to begin.</p>
          <Link href="/start" className="mt-4"><Button className="w-full rounded-xl">Start here <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </div>
        <div className={door}>
          <ShieldCheck className="h-6 w-6 text-indigo-600" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">Got a tip?</h2>
          <p className="mt-1 flex-1 text-sm text-slate-600">Paste the message. We check the company&apos;s real numbers and the warning signs.</p>
          <Link href="/check" className="mt-4"><Button className="w-full rounded-xl">Check it <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </div>
        <div className={door}>
          <Sparkles className="h-6 w-6 text-indigo-600" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">Have an idea?</h2>
          <form action="/ideas" method="get" className="mt-1 flex flex-1 flex-col">
            <div className="flex-1">
              <label htmlFor="idea-q" className="text-sm text-slate-600">Describe it in your own words.</label>
              <input id="idea-q" name="q" required placeholder="e.g. Safe companies that pay dividends"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <Button type="submit" className="mt-4 w-full rounded-xl">Describe it <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </form>
        </div>
      </div>

      {!hasForYou && (
        <p className="text-sm text-slate-500">
          Or start from a ready idea:{" "}
          {STARTER_IDEAS.slice(0, 3).map((s, i) => (
            <span key={s.slug}>{i > 0 && " · "}<Link href={`/ideas/s-${s.slug}`} className="text-indigo-600 underline underline-offset-2">{s.name}</Link></span>
          ))}
        </p>
      )}

      {hasForYou && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">For you</h2>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            {p.positions.length > 0 && (
              <div>
                <p className="text-sm text-slate-500">Your portfolio</p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums">{rupees(p.value)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  <Change value={p.dayPct} suffix="on the last day" /> ·{" "}
                  <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{p.pnl >= 0 ? "▲" : "▼"} {rupees(Math.abs(p.pnl))} ({pct(Math.abs(p.pnlPct))})</span> overall
                </p>
                {firstWarning && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{firstWarning.title}. <Link href="/portfolio" className="underline">See why</Link></p>}
                {soon.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {soon.map((e) => (
                      <li key={`${e.stock_id}-${e.kind}-${e.event_date}`} className="flex justify-between gap-3 py-2">
                        <span><span className="font-medium text-slate-900">{snaps.get(e.stock_id)?.name}</span> {e.kind === "results" ? "reports results" : `pays ₹${Number(e.amount).toFixed(2)} a share`}</span>
                        <span className="shrink-0 text-slate-500">{niceDate(e.event_date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/portfolio" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-indigo-600">Open portfolio <ArrowRight className="h-4 w-4" /></Link>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-500">Your saved ideas</p>
              {savedIdeas.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">Nothing saved yet. <Link href="/ideas" className="text-indigo-600 underline">Try an idea</Link>.</p>
              ) : (
                <ul className="mt-1 divide-y divide-slate-100">
                  {savedIdeas.map((i) => (
                    <li key={i.id}><Link href={`/ideas/${i.id}`} className="block py-2.5 hover:text-indigo-600"><span className="font-medium">{i.name}</span><span className="block truncate text-xs text-slate-500">{i.description}</span></Link></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
