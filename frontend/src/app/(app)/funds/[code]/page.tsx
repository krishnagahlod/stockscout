import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getByTicker, getPriceHistory } from "@/lib/market";
import { groupOf, type Fund } from "@/lib/funds";
import { rankOf } from "@/lib/glance";
import { worstFall } from "@/lib/risk";
import { niceDate, rupees } from "@/lib/format";
import { Change, Panel, Sources } from "@/components/kit";
import { PriceChart } from "../../stocks/[ticker]/price-chart";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: `Fund ${(await params).code} | StockScout` };
}

export default async function FundPage({ params }: { params: Promise<{ code: string }> }) {
  const code = Number((await params).code);
  if (!Number.isInteger(code)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("funds").select("*").eq("scheme_code", code).maybeSingle();
  if (!data) notFound();
  const fund = data as Fund;
  const group = groupOf(fund.category);

  const nifty = await getByTicker(supabase, "^NSEI");
  const [{ data: navs }, niftyHistory, { data: peers }] = await Promise.all([
    supabase.from("fund_nav").select("date, nav").eq("scheme_code", code).order("date", { ascending: true }).limit(2000),
    nifty ? getPriceHistory(nifty.stock_id, 8) : Promise.resolve([]),
    supabase.from("funds").select("ret_3y").eq("category", fund.category ?? "").not("ret_3y", "is", null),
  ]);
  const history = (navs ?? []).map((r) => { const v = Number(r.nav); return { date: r.date as string, open: v, high: v, low: v, close: v, volume: null }; });
  const peer3y = (peers ?? []).map((p) => Number(p.ret_3y));
  const r3 = fund.ret_3y != null && peer3y.length >= 5 ? rankOf(peer3y, Number(fund.ret_3y)) : null;
  const fall = worstFall(history);

  const returns: [string, number | null][] = [["1 year", fund.ret_1y], ["3 years, a year", fund.ret_3y], ["5 years, a year", fund.ret_5y]];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href={`/funds?group=${group.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />{group.title}</Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-slate-500">{fund.amc} · {fund.category}</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{fund.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Direct plan, Growth option · AMFI code {fund.scheme_code}</p>
        </div>
        <div className="md:text-right">
          <p className="font-display text-3xl font-bold tabular-nums">{rupees(fund.nav != null ? Number(fund.nav) : null, true)}</p>
          <p className="text-xs text-slate-400">NAV (price of one unit) on {niceDate(fund.nav_date)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <p className="text-sm font-semibold text-slate-500">What it holds</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{group.holds}</p>
          <p className="mt-2 text-sm text-slate-600">Ups and downs: {group.ups.toLowerCase()}. Usually for {group.horizon.toLowerCase()}.</p>
        </Panel>
        <Panel>
          <p className="text-sm font-semibold text-slate-500">Past returns</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            {returns.map(([label, v]) => (
              <div key={label} className="flex justify-between"><dt className="text-slate-600">{label}</dt><dd>{v == null ? <span className="text-slate-400">not enough history</span> : <Change value={Number(v)} />}</dd></div>
            ))}
          </dl>
          {r3 != null && <p className="mt-3 text-sm text-slate-600">Its 3-year return is higher than {Math.round(r3 * 100)}% of the {peer3y.length} funds in its category.</p>}
        </Panel>
        <Panel>
          <p className="text-sm font-semibold text-slate-500">How bad it got</p>
          {fall && fall.fall < -0.02 ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-700">₹1,000 put in at the high on {niceDate(fall.peakDate)} was worth <strong>{rupees(1000 * (1 + fall.fall))}</strong> at the low on {niceDate(fall.troughDate)}. {fall.recoveredDate ? `It was back above that high by ${niceDate(fall.recoveredDate)}.` : "It hasn't yet climbed back to that high."}</p>
          ) : <p className="mt-2 text-sm text-slate-700">No fall of more than 2% in our data since {history[0] ? niceDate(history[0].date) : "we started"}.</p>}
        </Panel>
      </div>

      <Panel>
        <PriceChart data={history} benchmark={niftyHistory.map(({ date, close }) => ({ date, close }))} name="This fund" lineOnly />
        <p className="mt-2 text-xs text-slate-500">Weekly NAVs before the last 30 days, daily after. Returns are approximate to within a week.</p>
      </Panel>

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900">Before you invest</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          <li><strong className="font-semibold">Direct plan:</strong> no distributor commission, so it costs less than the Regular plan of the same fund. Apps like Zerodha Coin, Groww, Kuvera and the fund house&apos;s own site offer Direct plans.</li>
          <li><strong className="font-semibold">Costs:</strong> check the expense ratio (yearly fee) and any exit load (a charge for selling early) on the fund&apos;s factsheet.</li>
          <li><strong className="font-semibold">SIP:</strong> you can put in a fixed amount every month, from as little as ₹100 to ₹500 in many funds.</li>
          <li><strong className="font-semibold">Tax:</strong> equity funds and debt funds are taxed differently when you sell. Check the current rules before you redeem.</li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">Information, not a recommendation. Past returns don&apos;t promise future ones. StockScout earns nothing from any fund.</p>
      </Panel>
      <Sources ids={["amfi", "mfapi", "nseIndex", "own"]} asOf={fund.nav_date} />
    </div>
  );
}
