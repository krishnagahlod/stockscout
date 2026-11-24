import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getPriceHistory, getUniverse } from "@/lib/market";
import { dayChange, yearChange, type MetricKey } from "@/lib/metrics";
import { businessVerdict, priceVerdict, trendVerdict, type Verdict } from "@/lib/glance";
import { crores, niceDate, pct, rupees, shortTicker } from "@/lib/format";
import { Change, MetricRow, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { StockChart } from "./stock-chart";
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

const DETAIL_GROUPS: { title: string; metrics: MetricKey[] }[] = [
  { title: "How good is the business?", metrics: ["roe", "net_margin", "debt_to_equity", "market_cap_cr"] },
  { title: "Is the price reasonable?", metrics: ["pe", "pb", "dividend_yield"] },
  { title: "How has the share behaved?", metrics: ["momentum_12m", "volatility_30d", "max_drawdown_1y", "beta", "rsi_14"] },
];

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const supabase = await createClient();
  const stock = await getByTicker(supabase, decodeURIComponent(ticker));
  if (!stock) notFound();

  const [universe, history, { data: news }] = await Promise.all([
    getUniverse(supabase),
    getPriceHistory(supabase, stock.stock_id, 5),
    supabase.from("news_items").select("id, title, summary, source, url, sentiment_score, published_at").eq("stock_id", stock.stock_id).order("published_at", { ascending: false }).limit(6),
  ]);

  const verdicts = [
    { heading: "The business", v: businessVerdict(stock) },
    { heading: "The price", v: priceVerdict(stock, universe) },
    { heading: "Recent trend", v: trendVerdict(stock) },
  ];
  const peers = universe
    .filter((u) => u.sector === stock.sector && u.stock_id !== stock.stock_id)
    .sort((a, b) => (b.market_cap_cr ?? 0) - (a.market_cap_cr ?? 0))
    .slice(0, 5);
  const inRange = stock.week_52_high && stock.week_52_low && stock.price
    ? (stock.price - stock.week_52_low) / (stock.week_52_high - stock.week_52_low) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />Home</Link>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{shortTicker(stock.ticker)} · {stock.sector}{stock.industry && stock.industry !== stock.sector ? ` · ${stock.industry}` : ""}</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{stock.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Company size {crores(stock.market_cap_cr)}</p>
        </div>
        <div className="md:text-right">
          <p className="font-display text-3xl font-bold tabular-nums">{rupees(stock.price, true)}</p>
          <p className="text-sm"><Change value={dayChange(stock)} suffix="last day" /> · <Change value={yearChange(stock)} suffix="1 year" /></p>
          <p className="text-xs text-slate-400 mt-1">Price on {niceDate(stock.price_date)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {verdicts.map(({ heading, v }) => (
          <Panel key={heading}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
            <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-semibold ${toneStyle[v.tone]}`}>{v.label}</span>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{v.text}</p>
          </Panel>
        ))}
      </div>

      <Panel>
        <StockChart data={history} />
        {inRange != null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500"><span>52-week low {rupees(stock.week_52_low)}</span><span>52-week high {rupees(stock.week_52_high)}</span></div>
            <div className="relative mt-1 h-2 rounded-full bg-slate-100">
              <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-indigo-600 ring-2 ring-white" style={{ left: `${Math.min(Math.max(inRange, 0), 1) * 100}%` }} />
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-slate-900">All the numbers</h2>
          <p className="text-sm text-slate-500 mb-2">Tap any line to see what it means. Company numbers from {niceDate(stock.fundamentals_date)}.</p>
          <div className="grid gap-x-8 md:grid-cols-2">
            {DETAIL_GROUPS.map((g) => (
              <div key={g.title} className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>
                {g.metrics.map((m) => <MetricRow key={m} metric={m} value={stock[m] as number | null} />)}
              </div>
            ))}
          </div>
        </Panel>
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
          <Link href={`/ideas?q=${encodeURIComponent(`Companies like ${stock.name} in ${stock.sector}`)}`}>
            <Button variant="secondary" className="mt-4 w-full rounded-xl"><Sparkles className="h-4 w-4 mr-2" />Find more like this</Button>
          </Link>
        </Panel>
      </div>

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Recent news</h2>
        <NewsPanel news={news ?? []} />
      </Panel>

      <p className="text-xs text-slate-400">Information to help you research, not advice to buy or sell. Data from public sources and may be delayed or incomplete.</p>
    </div>
  );
}
