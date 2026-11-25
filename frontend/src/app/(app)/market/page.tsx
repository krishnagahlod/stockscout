import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getUniverse } from "@/lib/market";
import { marketDay } from "@/lib/market-day";
import { upcoming, type StockEvent } from "@/lib/events";
import { dayChange, type StockSnapshot } from "@/lib/metrics";
import { crores, niceDate, rupees, shortTicker } from "@/lib/format";
import { Change, PageTitle, Panel, Sources } from "@/components/kit";
import { BROAD_INDICES, changeOver, gauge, getIndexHistory, weekly, type Gauge } from "@/lib/index-history";
import { ValuationChart } from "./valuation-chart";
import { FlowsChart } from "./flows-chart";
import { getFlows, lastSum } from "@/lib/flows";

export const metadata = { title: "Market today | StockScout" };

const p1 = (x: number) => `${Math.abs(x * 100).toFixed(1)}%`;

// up/down tints match the app's green/red; every tile also carries a signed number and arrow, so colour is never the only cue
function tileStyle(change: number): string {
  const a = Math.abs(change);
  if (a < 0.0025) return "bg-slate-100 text-slate-800";
  if (change > 0) return a < 0.01 ? "bg-emerald-50 text-emerald-900" : a < 0.02 ? "bg-emerald-200 text-emerald-950" : "bg-emerald-600 text-white";
  return a < 0.01 ? "bg-rose-50 text-rose-900" : a < 0.02 ? "bg-rose-200 text-rose-950" : "bg-rose-600 text-white";
}

const share = (x: number) => `${Math.round(x * 100)}%`;
const monthName = (m: string) => new Date(m).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const netWords = (v: number, who: string) => v >= 0 ? `${who} bought ${crores(v)} more shares than they sold` : `${who} sold ${crores(-v)} more than they bought`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${crores(Math.abs(v))}`;

function GaugeStat({ title, g, digits, unit = "", explain }: { title: string; g: Gauge; digits: number; unit?: string; explain: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{title}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums text-slate-900">{g.now.toFixed(digits)}{unit}</dd>
      <dd className="mt-1 text-sm text-slate-600">Lower than today on {share(g.lowerShare)} of days since {g.since.slice(0, 4)} (range {g.low.toFixed(digits)} to {g.high.toFixed(digits)}{unit}). {explain}</dd>
    </div>
  );
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
  const [universe, nifty, gold, { data: eventRows }, indexHist, vixHist, flows] = await Promise.all([
    getUniverse(), getByTicker(supabase, "^NSEI"), getByTicker(supabase, "GOLDBEES"),
    supabase.from("stock_events").select("stock_id, kind, event_date, amount, source").eq("kind", "results").gte("event_date", today).order("event_date").limit(400),
    Promise.all(BROAD_INDICES.map((i) => getIndexHistory(i.id, 11))),
    getIndexHistory("india vix", 11),
    getFlows(),
  ]);
  const indices = BROAD_INDICES.map((i, n) => {
    const h = indexHist[n];
    const [prev, last] = h.slice(-2);
    return { ...i, last, day: prev && last ? last.close / prev.close - 1 : null, y1: changeOver(h, 1), y5: changeOver(h, 5) };
  }).filter((i) => i.last);
  const n50 = indexHist[0];
  const pe = gauge(n50, "pe"), pb = gauge(n50, "pb"), dy = gauge(n50, "div_yield"), vix = gauge(vixHist, "close");
  const peLine = weekly(n50).filter((d) => d.pe).map((d) => ({ date: d.date, value: d.pe! }));
  const m = marketDay(universe);
  const flowDay = flows.days.at(-1);
  const flowSpan = flows.days.length >= 20 ? 20 : flows.days.length >= 5 ? 5 : 0;
  const fiiSum = flowSpan ? lastSum(flows.days.map((d) => d.fii), flowSpan) : null;
  const diiSum = flowSpan ? lastSum(flows.days.map((d) => d.dii), flowSpan) : null;
  const fpi12 = lastSum(flows.months.map((x) => x.equity), 12);
  const fpiLow = flows.months.reduce<typeof flows.months[number] | null>((a, x) => (!a || x.equity < a.equity ? x : a), null);
  const fpiHigh = flows.months.reduce<typeof flows.months[number] | null>((a, x) => (!a || x.equity > a.equity ? x : a), null);
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

      {indices.length > 0 && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">The main indices</h2>
          <p className="text-sm text-slate-500">An index tracks a fixed group of companies. Index funds and ETFs copy them.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-medium">Index</th>
                  <th scope="col" className="py-2 px-3 text-right font-medium">Close</th>
                  <th scope="col" className="py-2 px-3 text-right font-medium">Last day</th>
                  <th scope="col" className="py-2 px-3 text-right font-medium">1 year</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">5 years, a year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indices.map((i) => (
                  <tr key={i.id}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                      <span className="font-medium text-slate-900">{i.label}</span>
                      <span className="block text-xs text-slate-500">{i.note}</span>
                    </th>
                    <td className="py-2.5 px-3 text-right tabular-nums">{i.last!.close.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="py-2.5 px-3 text-right"><Change value={i.day} /></td>
                    <td className="py-2.5 px-3 text-right"><Change value={i.y1} /></td>
                    <td className="py-2.5 pl-3 text-right"><Change value={i.y5} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

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

      {pe && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">What the market costs, against its own past</h2>
          <p className="mt-1 text-slate-700 leading-relaxed">
            Buying the Nifty 50 today costs {pe.now.toFixed(1)} rupees for every rupee of yearly profit its companies make (its P/E).
            Since {pe.since.slice(0, 4)} that has ranged from {pe.low.toFixed(1)} to {pe.high.toFixed(1)}, with a middle of {pe.median.toFixed(1)}.
            It was lower than today on {share(pe.lowerShare)} of days.
          </p>
          <div className="mt-4"><ValuationChart points={peLine} median={pe.median} label={`Nifty 50 P/E each week since ${pe.since.slice(0, 4)}, now ${pe.now.toFixed(1)}`} /></div>
          <dl className="mt-5 grid gap-5 sm:grid-cols-3">
            {pb && <GaugeStat title="Price to book (P/B)" g={pb} digits={2} explain="Price against what the companies own, minus what they owe." />}
            {dy && <GaugeStat title="Dividend yield" g={dy} digits={2} unit="%" explain="Dividends paid in a year against today's price." />}
            {vix && <GaugeStat title="India VIX" g={vix} digits={1} explain="How big a swing traders expect in the next month. Higher means more nervous." />}
          </dl>
          <p className="mt-4 text-xs text-slate-500">A high or low number doesn&apos;t say what happens next; markets have stayed high or low for years. In April 2021 NSE switched to group profits for P/E, so earlier values read a little higher.</p>
        </Panel>
      )}

      {(flowDay || flows.months.length > 0) && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900">Big investors: buying or selling</h2>
          {flowDay && flowDay.fii != null && flowDay.dii != null && (
            <p className="mt-1 text-slate-700 leading-relaxed">
              On {niceDate(flowDay.date)}, {netWords(flowDay.fii, "foreign institutions")}, and {netWords(flowDay.dii, "Indian institutions (mutual funds, insurers, pension funds)")}.
              {fiiSum != null && diiSum != null
                ? <> Over the last {flowSpan} trading days: foreign {signed(fiiSum)}, Indian {signed(diiSum)}.</>
                : <> NSE only shows the latest day, so we keep each day from {niceDate(flows.days[0].date)}; a longer view builds up from here.</>}
            </p>
          )}
          {flows.months.length >= 12 && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-slate-500">Foreign investors, month by month since {flows.months[0].month.slice(0, 4)}</h3>
              <div className="mt-2"><FlowsChart points={flows.months.map((x) => ({ date: x.month, value: x.equity }))}
                label={`Foreign investors' net buying of Indian shares each month since ${flows.months[0].month.slice(0, 4)}, in rupees crore; latest ${monthName(flows.months.at(-1)!.month)}: ${signed(flows.months.at(-1)!.equity)}`} /></div>
              <p className="mt-3 text-sm text-slate-600">
                {fpi12 != null && <>Over the last 12 months they {fpi12 >= 0 ? "put in" : "took out"} {crores(Math.abs(fpi12))} net. </>}
                {fpiLow && fpiHigh && <>Their biggest monthly sale was {crores(-fpiLow.equity)} in {monthName(fpiLow.month)}; their biggest monthly purchase was {crores(fpiHigh.equity)} in {monthName(fpiHigh.month)}.</>}
              </p>
            </>
          )}
          <p className="mt-4 text-xs text-slate-500">Daily figures are NSE&apos;s first estimates across all exchanges; monthly ones are NSDL&apos;s final figures for foreign investors. Big investors move prices, but their buying or selling doesn&apos;t say what prices do next.</p>
        </Panel>
      )}

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
          <h2 className="font-display text-lg font-bold text-slate-900">Results due this week</h2>
          <p className="text-sm text-slate-500">Large companies due to report in the next 7 days. Dates marked “estimate” haven&apos;t been announced by the company yet and can move.</p>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 text-sm">
            {results.map((e) => {
              const s = byId.get(e.stock_id)!;
              return (
                <li key={e.stock_id} className="flex justify-between gap-3 border-b border-slate-50 py-2">
                  <Link href={`/stocks/${shortTicker(s.ticker)}`} className="font-medium text-slate-900 hover:text-indigo-600">{s.name}</Link>
                  <span className="shrink-0 text-slate-500">{niceDate(e.event_date)}{e.source !== "nse" && " (estimate)"}</span>
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

      <Sources ids={["nse", "nseIndex", "flows", "yahooCompany", "own"]} asOf={m.date} />
    </div>
  );
}
