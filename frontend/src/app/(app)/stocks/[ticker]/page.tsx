import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getPriceHistory, getUniverse } from "@/lib/market";
import { dayChange, yearChange, type MetricKey } from "@/lib/metrics";
import { businessVerdict, priceVerdict, trendVerdict, type Verdict } from "@/lib/glance";
import { monthsBetween, rolling, trendSince, worstFall } from "@/lib/risk";
import { eventSummary, type StockEvent } from "@/lib/events";
import { crores, niceDate, pct, rupees, shortTicker } from "@/lib/format";
import { Change, MetricRow, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { PriceChart } from "./price-chart";
import { NewsPanel } from "./news-panel";

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
  const [universe, history, niftyHistory, { data: news }, { data: eventRows }] = await Promise.all([
    getUniverse(supabase),
    getPriceHistory(supabase, stock.stock_id, 12),
    nifty ? getPriceHistory(supabase, nifty.stock_id, 12) : Promise.resolve([]),
    supabase.from("news_items").select("id, title, summary, source, url, sentiment_score, published_at").eq("stock_id", stock.stock_id).order("published_at", { ascending: false }).limit(6),
    supabase.from("stock_events").select("stock_id, kind, event_date, amount").eq("stock_id", stock.stock_id),
  ]);
  const events = eventSummary((eventRows ?? []) as StockEvent[], new Date().toISOString().slice(0, 10));

  const last = history[history.length - 1];
  const yearAgo = last ? `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}` : "";
  const lastYear = history.filter((p) => p.date >= yearAgo);
  const fall1y = worstFall(lastYear);
  const fallAll = worstFall(history);
  const oneYearWindows = rolling(history, 1);
  const trend = trendSince(history, 50);

  const trendCard = trendVerdict(stock);
  if (trend) trendCard.text = `Price ${trend.above ? "above" : "below"} its 50-day average since ${niceDate(trend.since)}. ${trendCard.text}`.trim();
  const verdicts = isFund
    ? [{ heading: "1 year", v: trendCard }]
    : [
        { heading: "The business", v: businessVerdict(stock, universe) },
        { heading: "The price", v: priceVerdict(stock, universe) },
        { heading: "Recent trend", v: trendCard },
      ];
  const peers = isFund ? [] : universe
    .filter((u) => u.sector === stock.sector && u.stock_id !== stock.stock_id)
    .sort((a, b) => (b.market_cap_cr ?? 0) - (a.market_cap_cr ?? 0))
    .slice(0, 5);
  const inRange = stock.week_52_high && stock.week_52_low && stock.price
    ? (stock.price - stock.week_52_low) / (stock.week_52_high - stock.week_52_low) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/home" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />Home</Link>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
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

      {!isFund && (events.nextResults || events.lastDividend) && (
        <p className="text-sm text-slate-600">
          {events.nextResults && <>Results expected around <strong className="font-semibold text-slate-800">{niceDate(events.nextResults.event_date)}</strong>. </>}
          {events.payments12m > 0
            ? <>Paid <strong className="font-semibold text-slate-800">₹{events.paid12m.toFixed(2)}</strong> a share in dividends over the past year ({events.payments12m} payment{events.payments12m > 1 ? "s" : ""}).</>
            : events.lastDividend ? <>No dividend in the past year; the last was on {niceDate(events.lastDividend.event_date)}.</> : null}
          {events.nextDividend && <> Next ex-dividend date: {niceDate(events.nextDividend.event_date)}.</>}
          {events.splits[0] && <> Split {events.splits[0].amount}-for-1 on {niceDate(events.splits[0].event_date)}.</>}
        </p>
      )}

      {fall1y && fall1y.fall < -0.05 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-[15px] leading-relaxed text-amber-950">
          <strong className="font-semibold">How bad it got this past year:</strong> ₹1,000 put in at the high on {niceDate(fall1y.peakDate)} was worth {rupees(1000 * (1 + fall1y.fall))} at the low on {niceDate(fall1y.troughDate)}.{" "}
          {fall1y.recoveredDate ? `It was back above that high by ${niceDate(fall1y.recoveredDate)}.` : "It hasn't yet climbed back to that high."}
        </div>
      )}

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

      <div className={`grid gap-6 ${peers.length || !isFund ? "lg:grid-cols-3" : ""}`}>
        <Panel className={isFund ? "lg:col-span-3" : "lg:col-span-2"}>
          <h2 className="font-display text-lg font-bold text-slate-900">Go deeper: every number</h2>
          <p className="text-sm text-slate-500 mb-2">Tap any line to see what it means.{!isFund && <> Company numbers from {niceDate(stock.fundamentals_date)}.</>}</p>
          <div className="grid gap-x-8 md:grid-cols-2">
            {DETAIL_GROUPS.filter((g) => !isFund || g.funds).map((g) => (
              <div key={g.title} className="mt-3">
                <p className="text-sm font-semibold text-slate-500">{g.title}</p>
                {g.metrics.map((m) => <MetricRow key={m} metric={m} value={stock[m] as number | null} />)}
              </div>
            ))}
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
        {!isFund && (
          <Panel>
            <h2 className="font-display text-lg font-bold text-slate-900 mb-2">Similar companies</h2>
            {peers.length === 0 ? <p className="text-sm text-slate-500">No similar companies in our list.</p> : (
              <ul className="divide-y divide-slate-100">
                {peers.map((p) => (
                  <li key={p.stock_id}>
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
            {peers.length > 0 && (
              <Link href={`/compare?t=${[stock, ...peers.slice(0, 2)].map((p) => shortTicker(p.ticker)).join(",")}`}>
                <Button className="mt-4 w-full rounded-xl">Compare with the two largest</Button>
              </Link>
            )}
            <Link href={`/ideas?q=${encodeURIComponent(`Companies like ${stock.name} in ${stock.sector}`)}`}>
              <Button variant="secondary" className="mt-2 w-full rounded-xl"><Sparkles className="h-4 w-4 mr-2" />Find more like this</Button>
            </Link>
          </Panel>
        )}
      </div>

      {(news?.length ?? 0) > 0 && (
        <Panel>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Recent news</h2>
          <NewsPanel news={news ?? []} />
        </Panel>
      )}

      <p className="text-xs text-slate-400">Information to help you research, not advice to buy or sell. Prices are end-of-day closes from public sources and may be delayed or incomplete. Past numbers don&apos;t promise future returns.</p>
    </div>
  );
}
