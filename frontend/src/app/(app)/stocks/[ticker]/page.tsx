import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getPriceHistory, getUniverse } from "@/lib/market";
import { dayChange, yearChange, type MetricKey } from "@/lib/metrics";
import { businessVerdict, priceVerdict, stockGlance, trendVerdict, type Verdict } from "@/lib/glance";
import { monthsBetween, rolling, trendSince, worstFall } from "@/lib/risk";
import { eventSummary, type StockEvent } from "@/lib/events";
import { adjustForSplits, peBand } from "@/lib/valuation";
import { crores, niceDate, pct, rupees, shortTicker } from "@/lib/format";
import { Change, MetricRow, Panel, Sources } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { PriceChart } from "./price-chart";
import { NewsPanel } from "./news-panel";
import { StockTabs } from "./stock-tabs";
import { AiExplainer } from "./ai-explainer";
import { Suspense } from "react";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: `${decodeURIComponent(ticker).toUpperCase()} | StockScout` };
}

const toneStyle: Record<Verdict["tone"], string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ok: "bg-slate-50 text-slate-700 border-slate-200",
  weak: "bg-amber-50 text-amber-800 border-amber-100",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};

const DETAIL_GROUPS: { title: string; metrics: MetricKey[]; funds?: boolean }[] = [
  { title: "How good is the business?", metrics: ["roe", "net_margin", "debt_to_equity", "market_cap_cr"] },
  { title: "Is the price reasonable?", metrics: ["pe", "pb", "dividend_yield"] },
  { title: "How has the price behaved?", metrics: ["momentum_12m", "volatility_30d", "max_drawdown_1y", "beta", "rsi_14"], funds: true },
];

const OWNER_ROWS = [["Promoter group", "promoter"], ["Foreign institutions", "fii"], ["Indian institutions", "dii"], ["of which mutual funds", "mutual_funds"], ["Individuals", "retail"], ["Promoter shares pledged", "pledged"]] as const;

const FUND_TEXT: Record<string, string> = {
  Index: "An index is a list that tracks a group of companies. You can't buy it directly; index funds and ETFs follow it for you.",
  ETF: "An ETF (exchange-traded fund) holds a basket of investments and trades like a share in your broker app. Before buying, check its yearly fee (expense ratio) on the fund's factsheet.",
};

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const supabase = await createClient();
  const stock = await getByTicker(supabase, decodeURIComponent(ticker));
  if (!stock) notFound();
  const isFund = stock.sector === "ETF" || stock.sector === "Index";
  const isIndex = stock.sector === "Index";

  const nifty = isIndex ? null : await getByTicker(supabase, "^NSEI");
  const [universe, history, niftyHistory, { data: news }, { data: eventRows }, { data: finRows }, { data: ownRows }] = await Promise.all([
    getUniverse(),
    getPriceHistory(stock.stock_id, 12),
    nifty ? getPriceHistory(nifty.stock_id, 12) : Promise.resolve([]),
    supabase.from("news_items").select("id, title, summary, source, url, sentiment_score, published_at").eq("stock_id", stock.stock_id).order("published_at", { ascending: false }).limit(6),
    supabase.from("stock_events").select("stock_id, kind, event_date, amount, source").eq("stock_id", stock.stock_id),
    supabase.from("stock_financials").select("freq, period_end, revenue, net_income, eps, operating_cash_flow, total_debt, exceptional, source, filed_on").eq("stock_id", stock.stock_id).order("period_end", { ascending: false }),
    supabase.from("stock_ownership").select("as_of, insiders, institutions, source, promoter, fii, dii, mutual_funds, retail, pledged").eq("stock_id", stock.stock_id).order("as_of", { ascending: true }),
  ]);
  const events = eventSummary((eventRows ?? []) as StockEvent[], new Date().toISOString().slice(0, 10));

  const last = history[history.length - 1];
  const yearAgo = last ? `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}` : "";
  const lastYear = history.filter((p) => p.date >= yearAgo);
  const fall1y = worstFall(lastYear);
  const fallAll = worstFall(history);
  const oneYearWindows = rolling(history, 1);
  const trend = trendSince(history, 50);

  type Fin = { freq: string; period_end: string; revenue: number | null; net_income: number | null; eps: number | null; operating_cash_flow: number | null; total_debt: number | null; exceptional: number | null; source: string; filed_on: string | null };
  // EPS in filings is as reported then; divide by later splits and bonus issues so years (and the P/E band) compare with today's prices
  const splits = ((eventRows ?? []) as StockEvent[]).filter((e) => e.kind === "split");
  const allFins = ((finRows ?? []) as Fin[]).map((f) => (f.source === "nse" ? adjustForSplits([f], splits)[0] : f));
  // once a company has filings, show only those: Yahoo defines some lines differently (banks' sales), so mixing misleads
  const fromFilings = allFins.some((f) => f.source === "nse");
  const fins = fromFilings ? allFins.filter((f) => f.source === "nse") : allFins;
  const annual = fins.filter((f) => f.freq === "annual").slice(0, 5);
  const quarters = fins.filter((f) => f.freq === "quarterly").slice(0, 6);
  const oneOff = (f: Fin) => f.exceptional != null && f.net_income != null && Math.abs(Number(f.exceptional)) >= 0.1 * Math.abs(Number(f.net_income)) && Math.abs(Number(f.exceptional)) >= 1e8;
  const band = isFund ? null : peBand(history, annual.map((a) => ({ period_end: a.period_end, eps: a.eps == null ? null : Number(a.eps) })));
  const priceCard = priceVerdict(stock, universe);
  const bandPos = band && stock.pe && stock.pe > 0
    ? { pos: (stock.pe < band.mid * 0.9 ? "below" : stock.pe > band.mid * 1.1 ? "above" : "close to") as "below" | "above" | "close to", years: Math.round(band.months / 12) }
    : null;
  if (band && bandPos) {
    priceCard.text += ` Against its own past: P/E ranged ${band.low.toFixed(0)} to ${band.high.toFixed(0)} over the last ${bandPos.years} years, so today's is ${bandPos.pos} its middle (${band.mid.toFixed(0)}).`;
  }
  const glance = isFund ? null : stockGlance(stock, bandPos);
  type Own = { as_of: string; insiders: number | null; institutions: number | null; source: string; promoter: number | null; fii: number | null; dii: number | null; mutual_funds: number | null; retail: number | null; pledged: number | null };
  const owners = (ownRows ?? []) as Own[];
  const filed = owners.filter((o) => o.source === "nse").slice(-5);
  const own = owners[owners.length - 1];
  const holder = filed[filed.length - 1];
  const share = (v: number | null) => (v == null ? "—" : pct(Number(v), 1));
  const cr = (v: number | null) => (v == null ? "—" : crores(Number(v) / 1e7));
  const delivVals = history.slice(-20).map((p) => p.delivery_pct).filter((v): v is number => v != null).map(Number);
  const deliv = !isFund && delivVals.length >= 5 ? { last: delivVals[delivVals.length - 1], avg: delivVals.reduce((a, v) => a + v, 0) / delivVals.length } : null;
  const trendCard = trendVerdict(stock);
  if (trend) trendCard.text = `Price ${trend.above ? "above" : "below"} its 50-day average since ${niceDate(trend.since)}. ${trendCard.text}`.trim();
  const verdicts = isFund
    ? [{ heading: "1 year", v: trendCard }]
    : [
        { heading: "The business", v: businessVerdict(stock, universe) },
        { heading: "The price", v: priceCard },
        { heading: "Recent trend", v: trendCard },
      ];
  const peers = isFund ? [] : universe
    .filter((u) => u.sector === stock.sector && u.stock_id !== stock.stock_id)
    .sort((a, b) => (b.market_cap_cr ?? 0) - (a.market_cap_cr ?? 0))
    .slice(0, 5);
  const inRange = stock.week_52_high && stock.week_52_low && stock.price
    ? (stock.price - stock.week_52_low) / (stock.week_52_high - stock.week_52_low) : null;

  const overview = (
    <>
      <div className={`grid gap-4 ${isFund ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {isFund && (
          <Panel>
            <p className="text-sm font-semibold text-slate-500">What this is</p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{FUND_TEXT[stock.sector]}{stock.industry ? ` This one follows: ${stock.industry}.` : ""}</p>
          </Panel>
        )}
        {verdicts.map(({ heading, v }) => (
          <Panel key={heading}>
            <p className="text-sm font-semibold text-slate-500">{heading}</p>
            <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-semibold ${toneStyle[v.tone]}`}>{v.label}</span>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{v.text}</p>
          </Panel>
        ))}
      </div>

      <Panel>
        <PriceChart data={history} benchmark={niftyHistory.map(({ date, close }) => ({ date, close }))} name={isIndex ? stock.name : shortTicker(stock.ticker)} isIndex={isIndex} />
        {inRange != null && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-500"><span>52-week low {rupees(stock.week_52_low)}</span><span>52-week high {rupees(stock.week_52_high)}</span></div>
            <div className="relative mt-1 h-2 rounded-full bg-slate-100">
              <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-indigo-600 ring-2 ring-white" style={{ left: `${Math.min(Math.max(inRange, 0), 1) * 100}%` }} />
            </div>
          </div>
        )}
      </Panel>

      {fall1y && fall1y.fall < -0.05 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-[15px] leading-relaxed text-amber-950">
          <strong className="font-semibold">How bad it got this past year:</strong> ₹1,000 put in at the high on {niceDate(fall1y.peakDate)} was worth {rupees(1000 * (1 + fall1y.fall))} at the low on {niceDate(fall1y.troughDate)}.{" "}
          {fall1y.recoveredDate ? `It was back above that high by ${niceDate(fall1y.recoveredDate)}.` : "It hasn't yet climbed back to that high."}
        </div>
      )}

      {!isFund && (events.nextResults || events.lastDividend) && (
        <p className="text-sm text-slate-600">
          {events.nextResults && (events.nextResults.source === "nse"
            ? <>Results due on <strong className="font-semibold text-slate-800">{niceDate(events.nextResults.event_date)}</strong>, as announced by the company. </>
            : <>Results expected around <strong className="font-semibold text-slate-800">{niceDate(events.nextResults.event_date)}</strong> (an estimate). </>)}
          {events.payments12m > 0
            ? <>Paid <strong className="font-semibold text-slate-800">₹{events.paid12m.toFixed(2)}</strong> a share in dividends over the past year ({events.payments12m} payment{events.payments12m > 1 ? "s" : ""}).</>
            : events.lastDividend ? <>No dividend in the past year; the last was on {niceDate(events.lastDividend.event_date)}.</> : null}
          {events.nextDividend && <> Next ex-dividend date: {niceDate(events.nextDividend.event_date)}.</>}
          {events.splits[0] && <> Split {events.splits[0].amount}-for-1 on {niceDate(events.splits[0].event_date)}.</>}
        </p>
      )}

      {!isFund && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-2">Similar companies</h2>
          {peers.length === 0 ? <p className="text-sm text-slate-500">No similar companies in our list.</p> : (
            <ul className="divide-y divide-slate-100 md:grid md:grid-cols-2 md:gap-x-8 md:divide-y-0">
              {peers.map((p) => (
                <li key={p.stock_id} className="md:border-b md:border-slate-100">
                  <Link href={`/stocks/${shortTicker(p.ticker)}`} className="flex items-center justify-between gap-2 py-2.5 hover:text-indigo-600">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{p.name}</span>
                      <span className="text-xs text-slate-400">P/E {p.pe?.toFixed(0) ?? "—"} · ROE {pct(p.roe, 0)}</span>
                    </span>
                    <Change value={yearChange(p)} className="text-xs" suffix="1y" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {peers.length > 0 && (
              <Link href={`/compare?t=${[stock, ...peers.slice(0, 2)].map((p) => shortTicker(p.ticker)).join(",")}`}>
                <Button className="w-full rounded-xl">Compare with the two largest</Button>
              </Link>
            )}
            <Link href={`/ideas?q=${encodeURIComponent(`Companies like ${stock.name} in ${stock.sector}`)}`}>
              <Button variant="secondary" className="w-full rounded-xl"><Sparkles className="h-4 w-4 mr-2" />Find more like this</Button>
            </Link>
          </div>
        </Panel>
      )}
    </>
  );

  const results = !isFund && annual.length + quarters.length > 0 && (
    <Panel>
      <h2 className="font-display text-lg font-bold text-slate-900">Results</h2>
      {annual.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm font-semibold text-slate-500 pb-2">Each year (to 31 March unless stated)</caption>
            <thead><tr className="border-b border-slate-100 text-left text-slate-500"><th className="py-2 font-medium">Year ending</th><th className="py-2 text-right font-medium">Sales</th><th className="py-2 text-right font-medium">Profit</th><th className="py-2 text-right font-medium">Profit margin</th><th className="py-2 text-right font-medium">EPS</th><th className="py-2 text-right font-medium">Cash from business</th><th className="py-2 text-right font-medium">Debt</th></tr></thead>
            <tbody>
              {annual.map((a) => (
                <tr key={a.period_end} className="border-b border-slate-50">
                  <td className="py-2">{niceDate(a.period_end)}</td>
                  <td className="py-2 text-right tabular-nums">{cr(a.revenue)}</td>
                  <td className="py-2 text-right tabular-nums">{cr(a.net_income)}{oneOff(a) && <sup className="ml-0.5 text-amber-600">*</sup>}</td>
                  <td className="py-2 text-right tabular-nums">{a.revenue && a.net_income != null ? pct(Number(a.net_income) / Number(a.revenue), 0) : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{a.eps == null ? "—" : `₹${Number(a.eps).toFixed(2)}`}</td>
                  <td className="py-2 text-right tabular-nums">{cr(a.operating_cash_flow)}</td>
                  <td className="py-2 text-right tabular-nums">{cr(a.total_debt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {quarters.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm font-semibold text-slate-500 pb-2">Each quarter, with the change from the same quarter a year earlier</caption>
            <thead><tr className="border-b border-slate-100 text-left text-slate-500"><th className="py-2 font-medium">Quarter ending</th><th className="py-2 text-right font-medium">Sales</th><th className="py-2 text-right font-medium">Profit</th></tr></thead>
            <tbody>
              {quarters.map((q) => {
                const prior = fins.find((f) => f.freq === "quarterly" && f.period_end.slice(5) === q.period_end.slice(5) && Number(f.period_end.slice(0, 4)) === Number(q.period_end.slice(0, 4)) - 1);
                const yoy = (a: number | null, b: number | null | undefined) => (a != null && b ? <Change value={Number(a) / Number(b) - 1} className="ml-2 text-xs" /> : null);
                return (
                  <tr key={q.period_end} className="border-b border-slate-50">
                    <td className="py-2">{niceDate(q.period_end)}</td>
                    <td className="py-2 text-right tabular-nums">{cr(q.revenue)}{yoy(q.revenue, prior?.revenue)}</td>
                    <td className="py-2 text-right tabular-nums">{cr(q.net_income)}{oneOff(q) && <sup className="ml-0.5 text-amber-600">*</sup>}{prior?.net_income && Number(prior.net_income) > 0 ? yoy(q.net_income, prior.net_income) : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {fromFilings ? <>Figures as the company filed them with NSE, for the whole group where it files group results.</> : <>Figures from Yahoo Finance.</>}
        {[...annual, ...quarters].some(oneOff) && <> * Includes one-off items, such as a business sold or a one-time charge, worth at least a tenth of the profit.</>}
        {fromFilings && <> EPS is adjusted for later splits and bonus issues.</>} ₹ Cr is crores (1 Cr = ₹1,00,00,000).
      </p>
    </Panel>
  );

  const ownersTab = !isFund && (holder || own) && (
    <Panel>
      <h2 className="font-display text-lg font-bold text-slate-900">Who owns it</h2>
      {holder ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {Number(holder.promoter) > 0 ? <>The promoter group (the founders or parent company) holds <strong className="font-semibold">{share(holder.promoter)}</strong>. </> : <>There is no promoter group: the company is owned entirely by institutions and the public. </>}
            {Number(holder.promoter) > 0 && holder.pledged != null && (Number(holder.pledged) > 0.001
              ? <>They have pledged <strong className="font-semibold text-amber-700">{share(holder.pledged)}</strong> of their own shares as security for loans. If the price falls far, lenders can sell those shares, which can push it down further.</>
              : <>None of their shares are pledged for loans.</>)}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-slate-500"><th scope="col" className="py-2 font-medium">Share of the company</th>{filed.map((o) => <th key={o.as_of} scope="col" className="py-2 text-right font-medium">{niceDate(o.as_of)}</th>)}</tr></thead>
              <tbody>
                {OWNER_ROWS.map(([label, k]) => (
                  <tr key={k} className="border-b border-slate-50">
                    <th scope="row" className={k === "mutual_funds" ? "py-2 pl-4 text-left font-normal text-slate-500" : "py-2 text-left font-normal"}>{label}</th>
                    {filed.map((o) => <td key={o.as_of} className="py-2 text-right tabular-nums">{share(o[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">From the company&apos;s shareholding filings with NSE.</p>
        </>
      ) : own && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Insiders, mostly the promoter group, hold {pct(own.insiders == null ? null : Number(own.insiders), 0)}; institutions such as mutual funds, insurers and foreign investors hold {pct(own.institutions == null ? null : Number(own.institutions), 0)}.
          {owners.length > 1 && owners[0].insiders != null && own.insiders != null && Math.abs(Number(own.insiders) - Number(owners[0].insiders)) >= 0.005 && <> Insiders&apos; share has {Number(own.insiders) > Number(owners[0].insiders) ? "risen" : "fallen"} from {pct(Number(owners[0].insiders), 0)} since {niceDate(owners[0].as_of)}.</>}
        </p>
      )}
    </Panel>
  );

  const numbers = (
    <Panel>
      <h2 className="font-display text-lg font-bold text-slate-900">Every number</h2>
      <p className="text-sm text-slate-500 mb-2">Tap any line to see what it means.{!isFund && <> Company numbers from {niceDate(stock.fundamentals_date)}.</>}</p>
      <div className="grid gap-x-8 md:grid-cols-2">
        {DETAIL_GROUPS.filter((g) => !isFund || g.funds).map((g) => (
          <div key={g.title} className="mt-3">
            <p className="text-sm font-semibold text-slate-500">{g.title}</p>
            {g.metrics.map((m) => <MetricRow key={m} metric={m} value={stock[m] as number | null} />)}
          </div>
        ))}
        {deliv && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-slate-500">Shares kept by buyers (delivery)</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              <strong>{Math.round(deliv.last)}%</strong> of shares traded on the last day were taken into buyers&apos; accounts; the 20-day average is <strong>{Math.round(deliv.avg)}%</strong>.
              <span className="block text-slate-500">The rest were bought and sold the same day. A higher share usually means more longer-term buyers; a sharp jump on a low share is mostly short-term trading.</span>
            </p>
          </div>
        )}
        {fallAll && history.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-slate-500">Since {history[0].date.slice(0, 4)}</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>Worst fall: <strong>−{Math.round(-fallAll.fall * 100)}%</strong>, from {niceDate(fallAll.peakDate)} to {niceDate(fallAll.troughDate)}. {fallAll.recoveredDate ? `Back at that high ${monthsBetween(fallAll.troughDate, fallAll.recoveredDate)} months after the low.` : "Not yet back at that high."}</li>
              {oneYearWindows && <li>Held for any 1 year, it lost money {Math.round(oneYearWindows.lossShare * 100)}% of the time. Best year: {pct(oneYearWindows.best, 0, true)}. Worst year: {pct(oneYearWindows.worst, 0, true)}.</li>}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );

  const tabs = [
    { id: "overview", label: "Overview", content: overview },
    results && { id: "results", label: "Results", content: results },
    ownersTab && { id: "owners", label: "Owners", content: ownersTab },
    { id: "numbers", label: "All numbers", content: numbers },
    (news?.length ?? 0) > 0 && { id: "news", label: "News", content: <Panel><NewsPanel news={news ?? []} /></Panel> },
  ].filter((t): t is { id: string; label: string; content: React.JSX.Element } => !!t);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link href="/home" className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />Home</Link>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{shortTicker(stock.ticker)} · {stock.sector}{stock.industry && stock.industry !== stock.sector ? ` · ${stock.industry}` : ""}</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{stock.name}</h1>
          {!isFund && <p className="mt-1 text-sm text-slate-500">Company size {crores(stock.market_cap_cr)}</p>}
        </div>
        <div className="md:text-right">
          <p className="font-display text-3xl font-bold tabular-nums">{isIndex ? stock.price?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : rupees(stock.price, true)}</p>
          <p className="text-sm"><Change value={dayChange(stock)} suffix="last day" /> · <Change value={yearChange(stock)} suffix="1 year" /></p>
          <p className="text-xs text-slate-400 mt-1">Close on {niceDate(stock.price_date)}</p>
        </div>
      </div>

      {glance && <p className="font-display text-lg md:text-xl leading-snug text-slate-800">{glance}</p>}

      {!isFund && (
        <Suspense fallback={null}>
          <AiExplainer stockId={stock.stock_id} dataDate={`${stock.fundamentals_date}|${stock.price_date}`} facts={[
            `Company: ${stock.name} (NSE: ${shortTicker(stock.ticker)}), ${stock.sector}${stock.industry ? `, ${stock.industry}` : ""}. Size ${crores(stock.market_cap_cr)}.`,
            ...(glance ? [glance] : []),
            ...verdicts.map(({ heading, v }) => `${heading}: ${v.label}. ${v.text}`),
            ...(events.payments12m > 0 ? [`Paid ₹${events.paid12m.toFixed(2)} a share in dividends over the past year.`] : []),
            ...(holder && Number(holder.pledged) > 0.001 ? [`Promoters have pledged ${share(holder.pledged)} of their shares for loans.`] : []),
          ]} />
        </Suspense>
      )}

      <StockTabs tabs={tabs} />

      <div className="space-y-2">
        <Sources ids={fromFilings || holder ? ["nse", "yahooPrices", "nseFilings", "yahooCompany", "own"] : ["nse", "yahooPrices", "yahooCompany", "own"]} asOf={stock.price_date} />
        {!isFund && stock.ratios_source === "yahoo" && <p className="text-xs text-slate-500">This company&apos;s P/E, ROE and other ratios are from Yahoo Finance: its recent filings on NSE are incomplete.</p>}
        <p className="text-xs text-slate-400">Past numbers don&apos;t promise future returns.</p>
      </div>
    </div>
  );
}
