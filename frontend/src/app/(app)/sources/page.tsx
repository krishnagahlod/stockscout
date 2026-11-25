import Link from "next/link";
import { getUniverse, dataAsOf, publicDb } from "@/lib/market";
import { getIndexHistory } from "@/lib/index-history";
import { SOURCES, type SourceId } from "@/lib/sources";
import { niceDate } from "@/lib/format";
import { PageTitle, Panel } from "@/components/kit";

export const metadata = { title: "Where our numbers come from | StockScout" };

const ORDER: SourceId[] = ["nse", "nseIndex", "nseFilings", "amfi", "yahooCompany", "yahooPrices", "mfapi", "own"];

export default async function SourcesPage() {
  const [universe, nifty, { data: fund }] = await Promise.all([
    getUniverse(),
    getIndexHistory("nifty 50", 1),
    publicDb().from("funds").select("nav_date").order("nav_date", { ascending: false, nullsFirst: false }).limit(1),
  ]);
  const fresh: [string, string | null][] = [
    ["Share and ETF prices", dataAsOf(universe)],
    ["Index values", nifty[nifty.length - 1]?.date ?? null],
    ["Mutual fund NAVs", fund?.[0]?.nav_date ?? null],
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageTitle title="Where our numbers come from" subtitle="Everything here is end-of-day: nothing is live, and nothing is a tip. This page lists each source, how often we update it and what to watch for." />

      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900">Latest data</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-3">
          {fresh.map(([label, d]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="font-display text-lg font-bold text-slate-900">{d ? `Close of ${niceDate(d)}` : "Not loaded yet"}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel className="p-0 md:p-0 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {ORDER.map((id) => {
            const s = SOURCES[id];
            const external = s.url.startsWith("http");
            return (
              <li key={id} className="p-5 md:p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {external ? <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-indigo-600 underline-offset-4 hover:underline">{s.name}</a> : s.name}
                  <span className="ml-2 text-sm font-normal text-slate-500">for {s.short}</span>
                </h2>
                <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-slate-500">What we take</dt><dd className="text-slate-800">{s.what}</dd>
                  <dt className="text-slate-500">How often</dt><dd className="text-slate-800">{s.when}</dd>
                  <dt className="text-slate-500">Good to know</dt><dd className="text-slate-800">{s.limits}</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel id="how">
        <h2 className="font-display text-lg font-bold text-slate-900">How we check prices every night</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li><b>Splits and bonus shares.</b> When a company splits each share into five, the price drops to a fifth overnight. That isn&apos;t a loss, so we adjust all earlier prices to match. Otherwise charts and worst-fall numbers would show a crash that never happened.</li>
          <li><b>One-day spikes.</b> A price that jumps and snaps straight back the next day is almost always a data error, so we drop it.</li>
          <li><b>Gaps.</b> If a source misses days, we leave the gap and don&apos;t guess, and we never treat the jump across a gap as a split.</li>
          <li><b>Two sources.</b> NSE&apos;s own file comes first. If it&apos;s missing for a day, Yahoo Finance fills in.</li>
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Results, owners and ratios such as P/E and ROE come from the files companies submit to NSE, read by us every Saturday. Where a company&apos;s filings are incomplete, Yahoo&apos;s summary fills in, and the company&apos;s page says so. Before a big decision, read the company&apos;s full results on{" "}
          <a href="https://www.nseindia.com/companies-listing/corporate-filings-financial-results" target="_blank" rel="noreferrer" className="text-indigo-600 underline">NSE&apos;s filings page</a>.
          New to these words? <Link href="/learn" className="text-indigo-600 underline">Start with the 2-minute lessons</Link>.
        </p>
      </Panel>
    </div>
  );
}
