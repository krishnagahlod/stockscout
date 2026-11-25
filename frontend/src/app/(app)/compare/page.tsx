import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getPriceHistory, getUniverse } from "@/lib/market";
import { METRICS, formatMetric, yearChange, type MetricKey, type StockSnapshot } from "@/lib/metrics";
import { businessVerdict, priceVerdict } from "@/lib/glance";
import { worstFall } from "@/lib/risk";
import { niceDate, rupees, shortTicker } from "@/lib/format";
import { PageTitle, Panel } from "@/components/kit";
import { CompareChart, SERIES_COLORS } from "./compare-chart";
import { AddCompany } from "./add-company";

export const metadata = { title: "Compare | StockScout" };

const ROWS: MetricKey[] = ["market_cap_cr", "roe", "net_margin", "debt_to_equity", "pe", "pb", "dividend_yield", "momentum_12m", "volatility_30d", "max_drawdown_1y", "beta"];

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const tickers = Array.from(new Set((await searchParams).t?.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) ?? [])).slice(0, 3);
  const supabase = await createClient();
  const found = (await Promise.all(tickers.map((t) => getByTicker(supabase, t)))).filter((s): s is StockSnapshot => !!s);
  const nifty = await getByTicker(supabase, "^NSEI");
  const [universe, histories, niftyHistory] = await Promise.all([
    getUniverse(supabase),
    Promise.all(found.map((s) => getPriceHistory(supabase, s.stock_id, 6))),
    nifty ? getPriceHistory(supabase, nifty.stock_id, 6) : Promise.resolve([]),
  ]);
  const codes = found.map((s) => shortTicker(s.ticker));
  const without = (code: string) => `/compare?t=${codes.filter((c) => c !== code).join(",")}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageTitle title="Compare" subtitle="Up to three companies or ETFs side by side, with the same numbers explained the same way." />
      <Panel>
        <AddCompany current={codes} />
        {found.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {found.map((s, i) => (
              <li key={s.stock_id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} aria-hidden />
                <Link href={`/stocks/${codes[i]}`} className="font-medium hover:text-indigo-600">{s.name}</Link>
                <Link href={without(codes[i])} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${s.name}`}>×</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {found.length === 0 ? (
        <Panel><p className="text-slate-700">Add a company above to start. Tip: open any stock page and use &ldquo;Compare&rdquo; to bring in similar companies.</p></Panel>
      ) : (
        <>
          <Panel>
            <CompareChart series={found.map((s, i) => ({ name: s.name, points: histories[i].map(({ date, close }) => ({ date, close })) }))} nifty={niftyHistory.map(({ date, close }) => ({ date, close }))} />
          </Panel>

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">Number</th>
                    {found.map((s) => <th key={s.stock_id} className="py-2 text-right font-medium text-slate-900">{shortTicker(s.ticker)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-600">Price<span className="block text-xs text-slate-400">close on {niceDate(found[0].price_date)}</span></td>
                    {found.map((s) => <td key={s.stock_id} className="py-2 text-right tabular-nums">{rupees(s.price, true)}</td>)}
                  </tr>
                  {found.some((s) => s.sector !== "ETF" && s.sector !== "Index") && (
                    <tr className="border-b border-slate-50 align-top">
                      <td className="py-2 pr-3 text-slate-600">At a glance</td>
                      {found.map((s) => {
                        const fund = s.sector === "ETF" || s.sector === "Index";
                        return <td key={s.stock_id} className="py-2 text-right text-xs text-slate-600">{fund ? "A fund" : <>{businessVerdict(s, universe).label}<br />{priceVerdict(s, universe).label}</>}</td>;
                      })}
                    </tr>
                  )}
                  <tr className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-600">Worst fall in 6 years</td>
                    {histories.map((h, i) => { const f = worstFall(h); return <td key={found[i].stock_id} className="py-2 text-right tabular-nums">{f ? `−${Math.round(-f.fall * 100)}%` : "—"}</td>; })}
                  </tr>
                  {ROWS.map((k) => (
                    <tr key={k} className="border-b border-slate-50">
                      <td className="py-2 pr-3 text-slate-600">{METRICS[k].label}<span className="block text-xs text-slate-400">{METRICS[k].better === "low" ? "lower is usually safer" : METRICS[k].better === "high" ? "higher is usually better" : METRICS[k].short}</span></td>
                      {found.map((s) => <td key={s.stock_id} className="py-2 text-right tabular-nums">{k === "momentum_12m" ? formatMetric(k, yearChange(s)) : formatMetric(k, s[k] as number | null)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">Company numbers from the latest reports we have. Tap a company&apos;s name for every number explained. Information, not a recommendation.</p>
          </Panel>
        </>
      )}
    </div>
  );
}
