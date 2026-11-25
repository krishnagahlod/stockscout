import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getUniverse } from "@/lib/market";
import { marketDay } from "@/lib/market-day";
import { upcoming, type StockEvent } from "@/lib/events";
import { dayChange, type StockSnapshot } from "@/lib/metrics";
import { niceDate, rupees, shortTicker } from "@/lib/format";
import { Change, PageTitle, Panel } from "@/components/kit";

export const metadata = { title: "Market today | StockScout" };

const p1 = (x: number) => `${Math.abs(x * 100).toFixed(1)}%`;

// up/down tints match the app's green/red; every tile also carries a signed number and arrow, so colour is never the only cue
function tileStyle(change: number): string {
  const a = Math.abs(change);
  if (a < 0.0025) return "bg-slate-100 text-slate-800";
  if (change > 0) return a < 0.01 ? "bg-emerald-50 text-emerald-900" : a < 0.02 ? "bg-emerald-200 text-emerald-950" : "bg-emerald-600 text-white";
  return a < 0.01 ? "bg-rose-50 text-rose-900" : a < 0.02 ? "bg-rose-200 text-rose-950" : "bg-rose-600 text-white";
}

function MoverList({ title, list }: { title: string; list: StockSnapshot[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
      {list.length === 0 ? <p className="mt-2 text-sm text-slate-500">None today.</p> : (
        <ul className="mt-1 divide-y divide-slate-100">
          {list.map((s) => (
            <li key={s.stock_id}>
              <Link href={`/stocks/${shortTicker(s.ticker)}`} className="flex items-center justify-between gap-3 py-2 hover:text-indigo-600">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{s.name}</span><span className="text-xs text-slate-400">{s.sector}</span></span>
                <span className="text-right text-sm"><span className="block tabular-nums">{rupees(s.price, true)}</span><Change value={dayChange(s)} className="text-xs" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function MarketPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [universe, nifty, gold, { data: eventRows }] = await Promise.all([
    getUniverse(supabase), getByTicker(supabase, "^NSEI"), getByTicker(supabase, "GOLDBEES"),
    supabase.from("stock_events").select("stock_id, kind, event_date, amount").eq("kind", "results").gte("event_date", today).order("event_date").limit(400),
  ]);
  const m = marketDay(universe);
  const byId = new Map(universe.map((s) => [s.stock_id, s]));
  const results = upcoming((eventRows ?? []) as StockEvent[], today, 7)
    .filter((e) => (byId.get(e.stock_id)?.market_cap_cr ?? 0) >= 20000)
    .slice(0, 12);
  const niftyDay = nifty ? dayChange(nifty) : null;
  // the headline names only industries big enough to mean something
  const sizeable = m.sectors.filter((s) => s.count >= 5);
  const lead = sizeable[0];
  const lag = sizeable[sizeable.length - 1];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageTitle title="Market today" subtitle={m.date ? `End-of-day numbers for ${niceDate(m.date)}. Nothing here updates during the day.` : "No market data yet."} />

      <Panel>
        <p className="font-display text-xl md:text-2xl font-bold leading-snug text-slate-900">
          {niftyDay != null && <>The Nifty 50 {niftyDay >= 0 ? "rose" : "fell"} {p1(niftyDay)}. </>}
          {m.rose} of {m.count} Nifty 500 companies rose and {m.fell} fell.
          {lead && lag && lead !== lag && <> {lead.name} did best ({lead.change >= 0 ? "+" : "−"}{p1(lead.change)}); {lag.name} did worst ({lag.change >= 0 ? "+" : "−"}{p1(lag.change)}).</>}
        </p>
        <p className="mt-2 text-sm text-slate-500">One day&apos;s move says little about a company. It&apos;s here so the news makes sense, not as a reason to buy or sell.</p>
      </Panel>

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900">Industries, best to worst</h2>
        <p className="text-sm text-slate-500">Average move of each industry&apos;s companies, with bigger companies counting more.</p>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {m.sectors.map((s) => (
            <li key={s.name} className={`rounded-2xl p-3 ${tileStyle(s.change)}`}
              title={`Best: ${s.best.name} (${((dayChange(s.best) ?? 0) * 100).toFixed(1)}%). Worst: ${s.worst.name} (${((dayChange(s.worst) ?? 0) * 100).toFixed(1)}%).`}>
              <p className="text-sm font-semibold leading-tight">{s.name}</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">{s.change >= 0 ? "▲" : "▼"} {p1(s.change)}</p>
              <p className="text-xs opacity-80">{s.rose} of {s.count} rose</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900">Biggest moves among large companies</h2>
        <p className="text-sm text-slate-500">Companies worth over ₹20,000 Cr.</p>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <MoverList title="Rose the most" list={m.up} />
          <MoverList title="Fell the most" list={m.down} />
        </div>
      </Panel>

      {results.length > 0 && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">Results expected this week</h2>
          <p className="text-sm text-slate-500">Large companies due to report in the next 7 days. Dates are expected ones and can move.</p>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 text-sm">
            {results.map((e) => {
              const s = byId.get(e.stock_id)!;
              return (
                <li key={e.stock_id} className="flex justify-between gap-3 border-b border-slate-50 py-2">
                  <Link href={`/stocks/${shortTicker(s.ticker)}`} className="font-medium text-slate-900 hover:text-indigo-600">{s.name}</Link>
                  <span className="shrink-0 text-slate-500">{niceDate(e.event_date)}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <details className="glass-card rounded-3xl p-5 md:p-6 group">
        <summary className="cursor-pointer list-none font-display font-bold text-slate-900">Go deeper <span className="text-sm font-normal text-slate-500 group-open:hidden">(the wider picture, tap to see)</span></summary>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2 text-sm">
          {m.above200 != null && (
            <div>
              <dt className="font-semibold text-slate-900">{Math.round(m.above200 * 100)}% of the Nifty 500 trade above their 200-day average price</dt>
              <dd className="mt-1 text-slate-600">A rough gauge of the longer trend. Above 60% means most companies have been rising for months; below 40% means most have been falling.</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-slate-900">{m.nearHigh} near their 1-year high, {m.nearLow} near their 1-year low</dt>
            <dd className="mt-1 text-slate-600">Within 3% of the highest or lowest price of the past year.</dd>
          </div>
          {nifty && (
            <div>
              <dt className="font-semibold text-slate-900">Nifty 50 over 1 year: <Change value={nifty.price && nifty.close_1y_ago ? nifty.price / nifty.close_1y_ago - 1 : null} /></dt>
              <dd className="mt-1 text-slate-600"><Link href="/stocks/%5ENSEI" className="text-indigo-600 underline">See the Nifty 50 chart</Link></dd>
            </div>
          )}
          {gold && (
            <div>
              <dt className="font-semibold text-slate-900">Gold (Gold BeES ETF) today: <Change value={dayChange(gold)} /></dt>
              <dd className="mt-1 text-slate-600">Gold often moves differently from shares.</dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  );
}
